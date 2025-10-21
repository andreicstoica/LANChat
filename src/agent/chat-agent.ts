import { io, type Socket } from "socket.io-client";
import { Honcho } from "@honcho-ai/sdk";
import { getLLMProvider } from "../llm/factory.ts";
import type { LLMProvider, LLMMessage } from "../llm/interface.ts";
import type {
  Message,
  ResponseDecision,
  PsychologyAnalysis,
} from "../types.ts";
import { AgentContextManager } from "./context-manager.ts";
import { AgentToolbox } from "./toolbox.ts";
import { DecisionEngine } from "./decision-engine.ts";
import {
  createWorkspaceId,
  sanitizeUsername,
} from "./utils.ts";

export class ChatAgent {
  protected socket: Socket | null = null;
  protected readonly agentName: string;
  protected readonly agentPeerId: string;
  protected readonly llm: LLMProvider;
  protected readonly honcho: Honcho;
  protected readonly systemPrompt: string;
  protected temperature = 0.7;
  protected responseLength = 100;
  protected sessionId: string | null = null;

  private readonly contextManager: AgentContextManager;
  private readonly toolbox: AgentToolbox;
  private readonly decisionEngine: DecisionEngine;
  private serverUrl: string;

  constructor(agentName: string, systemPrompt?: string, serverUrl?: string) {
    this.agentName = agentName;
    this.agentPeerId = sanitizeUsername(agentName);
    this.llm = getLLMProvider();
    this.serverUrl = serverUrl || Bun.env.CHAT_SERVER || "http://localhost:3000";

    const workspaceId = createWorkspaceId(agentName);
    this.honcho = new Honcho({
      baseURL: process.env.HONCHO_BASE_URL || "http://localhost:8000",
      apiKey: process.env.HONCHO_API_KEY,
      workspaceId,
    });

    this.systemPrompt =
      systemPrompt ??
      defaultSystemPrompt(agentName);

    this.contextManager = new AgentContextManager(
      this.honcho,
      this.agentName,
      this.agentPeerId,
    );
    this.toolbox = new AgentToolbox(this.llm, this.honcho, this.agentName);
    this.decisionEngine = new DecisionEngine(this.llm, this.agentName);
  }

  async connect(serverUrl?: string): Promise<void> {
    const targetUrl = serverUrl || this.serverUrl;
    this.serverUrl = targetUrl;

    console.log(`🤖 ${this.agentName} connecting to ${targetUrl}...`);

    this.socket = io(targetUrl, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on("connect", () => {
      console.log("✅ Connected to chat server");

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

    this.socket.on("message", async (message: Message) => {
      if (message.type === "chat" && message.username !== this.agentName) {
        await this.processMessage(message);
      }
    });

    this.socket.on("session_id", (sessionId: string) => {
      this.sessionId = sessionId;
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  protected async processMessage(message: Message): Promise<void> {
    if (!this.sessionId) {
      console.log("⚠️ No session ID yet, skipping message processing");
      return;
    }

    try {
      const contextResult = await this.contextManager.prepareContext(
        this.sessionId,
        message,
      );

      const decision = await this.decisionEngine.shouldRespond(
        message,
        contextResult.recentContext,
      );

      console.log(
        `🤔 Decision: ${decision.should_respond ? "Yes" : "No"} - ${decision.reason}`,
      );

      if (!decision.should_respond) {
        return;
      }

      const tracker: Record<string, any> = {};

      await this.decisionEngine.planResponse({
        message,
        recentContext: contextResult.recentContext,
        tracker,
        tools: {
          analyzePsychology: () =>
            this.toolbox.analyzePsychology({
              message,
              recentContext: contextResult.recentContext,
              sessionId: this.sessionId,
            }),
          search: () =>
            this.toolbox.search({
              message,
              recentContext: contextResult.recentContext,
              sessionId: this.sessionId,
            }),
        },
        generateResponse: (decisionTracker) =>
          this.generateResponse(message, contextResult.recentContext, decisionTracker),
      });
    } catch (error) {
      console.error(
        `Error processing message from ${message.username}:`,
        error,
      );
    }
  }

  protected async generateResponse(
    message: Message,
    recentContext: string,
    tracker: Record<string, any>,
  ): Promise<void> {
    try {
      console.log("💭 Generating response...");

      const messages: LLMMessage[] = [
        {
          role: "system",
          content: this.systemPrompt,
        },
        {
          role: "user",
          content: buildResponsePrompt({
            agentName: this.agentName,
            recentContext,
            message,
            tracker,
          }),
        },
      ];

      const response = await this.llm.chat(messages, {
        temperature: this.temperature,
        max_tokens: this.responseLength + 50,
      });

      const responseContent = response.content?.trim();
      if (!responseContent) {
        console.error("Empty response from LLM - full response:", response);
        return;
      }

      console.log(
        `📤 Sending response: ${responseContent.substring(0, 50)}...`,
      );

      this.socket?.emit("chat", { content: responseContent });

      if (this.sessionId) {
        await this.contextManager.recordAgentMessage(this.sessionId, responseContent);
      }
    } catch (error) {
      console.error("Error generating response:", error);
    }
  }

  protected sanitizeUsername(username: string): string {
    return sanitizeUsername(username);
  }
}

function defaultSystemPrompt(agentName: string): string {
  return `You are ${agentName}, a participant in a group chat. 
You have access to a psychology analysis tool that can help you understand participants better.
Use it when you think it would help you provide a more insights on how to appropriately respond to something.
Respond naturally and conversationally. Keep responses concise.

Feel empowered to be chatty and ask follow-up questions.
`;
}

function buildResponsePrompt({
  agentName,
  recentContext,
  message,
  tracker,
}: {
  agentName: string;
  recentContext: string;
  message: Message;
  tracker: Record<string, any>;
}): string {
  const psychology =
    tracker["psychology"] != null
      ? `Psychology analysis of ${message.username}: ${JSON.stringify(
          tracker["psychology"],
          null,
          2,
        )}`
      : "";

  const search =
    tracker["search"] != null
      ? `Semantic search of conversation history: ${JSON.stringify(
          tracker["search"],
          null,
          2,
        )}`
      : "";

  return `Recent conversation, summary, and/or peer information:
${recentContext}

${message.username} said: "${message.content}"

${psychology}

${search}

Please respond naturally as ${agentName}.`;
}

export type { Message, ResponseDecision, PsychologyAnalysis };
