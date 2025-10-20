#!/usr/bin/env bun

import { io, type Socket } from "socket.io-client";
import { Honcho } from "@honcho-ai/sdk";
import { getLLMProvider } from "./llm/factory.js";
import type { LLMProvider, LLMMessage } from "./llm/interface.js";
import type {
  Message,
  ResponseDecision,
  PsychologyAnalysis,
  AgentDecision,
  Dialectic,
  Search,
} from "./types.js";

// Parse command line arguments
const args = process.argv.slice(2);
const AGENT_NAME = args.find((arg) => !arg.startsWith("--")) || "Assistant";
const serverArg = args.find((arg) => arg.startsWith("--server="));
const SERVER_URL = serverArg
  ? serverArg.split("=")[1]
  : Bun.env.CHAT_SERVER || "http://localhost:3000";

// LLM configuration is now handled by the LLM provider factory

class ChatAgent {
  protected socket: Socket | null = null;
  protected agentName: string;
  protected llm: LLMProvider;
  protected systemPrompt: string;
  protected temperature: number = 0.7;
  protected responseLength: number = 100;
  protected sessionId: string | null = null;

  protected honcho: Honcho;

  constructor(agentName: string, systemPrompt?: string) {
    this.agentName = agentName;
    this.llm = getLLMProvider();

    this.honcho = new Honcho({
      baseURL: process.env.HONCHO_BASE_URL || "http://localhost:8000",
      apiKey: process.env.HONCHO_API_KEY,
      workspaceId: agentName,
    });

    this.systemPrompt =
      systemPrompt ||
      `You are ${agentName}, a participant in a group chat. 
You have access to a psychology analysis tool that can help you understand participants better.
Use it when you think it would help you provide a more insights on how to appropriately respond to something.
Respond naturally and conversationally. Keep responses concise.

Feel empowered to be chatty and ask follow-up questions.
`;
  }

  async connect(): Promise<void> {
    console.log(`🤖 ${this.agentName} connecting to ${SERVER_URL}...`);

    this.socket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on("connect", () => {
      console.log("✅ Connected to chat server");

      // Register as an agent
      this.socket!.emit("register", {
        username: this.agentName,
        type: "agent",
      });
    });

    this.socket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error.message);
      if (error.message.includes("https")) {
        console.log(
          "💡 Note: Server might be using HTTP, not HTTPS. Try: --server=http://192.168.1.177:3000",
        );
      }
    });

    this.socket.on("disconnect", (reason) => {
      console.log(`❌ Disconnected from server: ${reason}`);
    });

    // Listen to all messages
    this.socket.on("message", async (message: Message) => {
      // Only process chat messages from others
      if (message.type === "chat" && message.username !== this.agentName) {
        await this.processMessage(message);
      }
    });

    // Receive session id from server
    this.socket.on("session_id", (sessionId: string) => {
      this.sessionId = sessionId;
    });
  }

  private async processMessage(message: Message): Promise<void> {
    if (!this.sessionId) {
      console.log("⚠️ No session ID yet, skipping message processing");
      return;
    }
    const session = await this.honcho.session(this.sessionId);
    const senderPeer = await this.honcho.peer(
      this.sanitizeUsername(message.username),
    );
    // Build context
    const context = await session.getContext({
      summary: true,
      tokens: 5000,
      lastUserMessage: message.content,
      peerTarget: message.username,
    });
    const recentContext: string = context.toOpenAI(this.agentName).join("\n");
    // add message to honcho
    await session.addMessages([senderPeer.message(message.content)]);
    // State 1: Decide if we should respond
    const decision = await this.shouldRespond(message, recentContext);
    console.log(
      `🤔 Decision: ${decision.should_respond ? "Yes" : "No"} - ${decision.reason}`,
    );

    if (!decision.should_respond) {
      return;
    }

    await this.decideAction(message, recentContext, {});
  }

  private async decideAction(
    message: Message,
    recentContext: string,
    tracker: Record<string, any>,
  ): Promise<void> {
    // analyze psychology
    // search for additional context
    // response directly
    try {
      const response = await this.llm.generate(
        `You are ${this.agentName} in a group chat. Based on the recent conversation and the latest message, decide if you should respond.

Recent conversation, summary, and/or peer information:
${recentContext}

Latest message from ${message.username}: "${message.content}"

You have 3 different tools you can use to gather more context before responding. They are

1. Analyze the psychology - This lets you ask a question to a model of an agent to better understand them and learn how to respond appropriately

2. Search for additional context - This lets you search the conversation history with a query 

3. Respond directly - This lets you respond directly to the user

Respond with a JSON object with this exact format:
{
  "decision": psychology or search or respond,
  "reason": "brief explanation",
  "confidence": 0.0 to 1.0
}

JSON response:`,
        {
          temperature: 0.3,
          max_tokens: 100,
          format: "json",
        }
      );

      // Parse the response
      const decision = JSON.parse(response.content) as AgentDecision;

      if (
        decision.decision === "psychology" &&
        tracker["psychology"] === undefined
      ) {
        const psychologyResponse = await this.analyzePsychology(
          message,
          recentContext,
        );
        console.log("Psychology response:", psychologyResponse);
        tracker["psychology"] = psychologyResponse;
        return await this.decideAction(message, recentContext, tracker);
      } else if (
        decision.decision === "search" &&
        tracker["search"] === undefined
      ) {
        const searchResponse = await this.search(message, recentContext);
        // Fix: searchResponse is already the data, no need to call .data()
        const messages = [];
        if (searchResponse && Array.isArray(searchResponse)) {
          for (const msg of searchResponse) {
            messages.push(msg);
          }
        } else if (searchResponse) {
          // Handle if it's a single message or different format
          messages.push(searchResponse);
        }
        tracker["search"] = messages;
        return await this.decideAction(message, recentContext, tracker);
      } else {
        await this.generateResponse(message, recentContext, tracker);
      }
    } catch (error) {
      console.error("Error in decision making:", error);
      // Default to not responding on error
      return;
    }
  }

  private async shouldRespond(
    message: Message,
    recentContext: string,
  ): Promise<ResponseDecision> {
    try {
      const response = await this.llm.generate(
        `You are ${this.agentName} in a group chat. Based on the recent conversation and the latest message, decide if you should respond.

Recent conversation, summary, and/or peer information:
${recentContext}

Latest message from ${message.username}: "${message.content}"

Respond with a JSON object with this exact format:
{
  "should_respond": true or false,
  "reason": "brief explanation",
  "confidence": 0.0 to 1.0
}

Consider:
- Is the message directed at you or mentioning you?
- Is it a question that needs answering?
- Would your response add value to the conversation?
- Have you responded too much recently?

lean on the side of responding and keeping the conversation going

JSON response:`,
        {
          temperature: 0.3,
          max_tokens: 100,
          format: "json",
        }
      );

      // Parse the response
      const decision = JSON.parse(response.content) as ResponseDecision;
      return decision;
    } catch (error) {
      console.error("Error in decision making:", error);
      // Default to not responding on error
      return {
        should_respond: false,
        reason: "Error in decision process",
        confidence: 0.0,
      };
    }
  }

  private async search(message: Message, recentContext: string): Promise<any> {
    try {
      const response = await this.llm.generate(
        `You are ${this.agentName} in a group chat. You want to search the conversation history to get more context on something.

Recent conversation:
${recentContext}

Latest message from ${message.username}: "${message.content}"

Decide on a semantic query to search for in the conversation history

Respond with a JSON object with this exact format:
{
  "query": Word or Phrase you want to search to get more context,
}

JSON response:`,
        {
          temperature: 0.3,
          max_tokens: 100,
          format: "json",
        }
      );

      const search = JSON.parse(response.content) as Search;

      if (!this.sessionId) {
        console.log("⚠️ No session ID yet, skipping search");
        return;
      }
      const session = await this.honcho.session(this.sessionId);
      const semanticResponse = await session.search(search.query);

      return semanticResponse;
    } catch (error) {
      console.error("Error generating response:", error);
    }
  }

  private async analyzePsychology(
    message: Message,
    recentContext: string,
  ): Promise<any> {
    try {
      const response = await this.llm.generate(
        `You are ${this.agentName} in a group chat. You want to analyze the psychology of a participant more deeply to understand how to best respond.

Recent conversation:
${recentContext}

Latest message from ${message.username}: "${message.content}"

Decide who you want to ask a question about and what question you want to ask 

Respond with a JSON object with this exact format:
{
  "target": string,
  "question": "What do you want to know about the target that would help you respond?",
}

JSON response:`,
        {
          temperature: 0.3,
          max_tokens: 100,
          format: "json",
        }
      );

      const dialectic = JSON.parse(response.content) as Dialectic;

      const peer = await this.honcho.peer(
        this.sanitizeUsername(dialectic.target),
      );
      const dialecticResponse = await peer.chat(dialectic.question, {
        sessionId: this.sessionId || undefined,
      });
      return dialecticResponse;
    } catch (error) {
      console.error("Error generating response:", error);
    }
  }

  private async generateResponse(
    message: Message,
    recentContext: string,
    tracker: Record<string, any>,
  ): Promise<void> {
    try {
      console.log(`💭 Generating response...`);

      // Initial chat with tools
      const messages: LLMMessage[] = [
        {
          role: "system",
          content: this.systemPrompt,
        },
        {
          role: "user",
          content: `Recent conversation, summary, and/or peer information:
${recentContext}

${message.username} said: "${message.content}"

${tracker["psychology"] ? `Psychology analysis of ${message.username}: ${JSON.stringify(tracker["psychology"], null, 2)}` : ""}

${tracker["search"] ? `Semantic search of conversation history: ${JSON.stringify(tracker["search"], null, 2)}` : ""}

Please respond naturally as ${this.agentName}.`,
        },
      ];

      const response = await this.llm.chat(messages, {
        temperature: this.temperature,
        max_tokens: this.responseLength + 50, // Extra tokens for tool calls
      });

      // Debug logging
      console.log("LLM response:", JSON.stringify(response, null, 2));

      const responseContent = response.content?.trim();

      if (!responseContent) {
        console.error("Empty response from LLM - full response:", response);
        return;
      }

      console.log(
        `📤 Sending response: ${responseContent.substring(0, 50)}...`,
      );
      this.socket!.emit("chat", {
        content: responseContent,
      });
      // save our own message to honcho
      if (this.sessionId) {
        const session = await this.honcho.session(this.sessionId);
        const peer = await this.honcho.peer(this.sanitizeUsername(this.agentName));
        await session.addMessages([peer.message(responseContent)]);
      }
    } catch (error) {
      console.error("Error generating response:", error);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  private sanitizeUsername(username: string): string {
    return username
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_|_$/g, "");
  }
}

// Export the class for extension
export {
  ChatAgent,
  type Message,
  type ResponseDecision,
  type PsychologyAnalysis,
};

// Only run if this file is executed directly
if (import.meta.main) {
  const agent = new ChatAgent(AGENT_NAME);
  agent.connect().catch(console.error);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n👋 Shutting down...");
    agent.disconnect();
    process.exit(0);
  });
}
