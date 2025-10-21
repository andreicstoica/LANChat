import type { LLMProvider } from "../llm/interface.ts";
import type { Honcho } from "@honcho-ai/sdk";
import type { Message, Dialectic, Search } from "../types.ts";
import { psychologySchema, searchSchema } from "./schemas.ts";
import { safeParse, sanitizeUsername } from "./utils.ts";

interface ToolContext {
  message: Message;
  recentContext: string;
  sessionId: string | null;
}

export class AgentToolbox {
  constructor(
    private readonly llm: LLMProvider,
    private readonly honcho: Honcho,
    private readonly agentName: string,
  ) { }

  async analyzePsychology({ message, recentContext, sessionId }: ToolContext) {
    console.log(`🔍 ${this.agentName} executing psychology analysis tool...`);
    const prompt = `You are ${this.agentName} in a group chat. You want to analyze the psychology of a participant more deeply to understand how to best respond.

Recent conversation:
${recentContext}

Latest message from ${message.username}: "${message.content}"

Decide who you want to ask a question about and what question you want to ask 

Respond with a JSON object with this exact format:
{
  "target": string,
 "question": "What do you want to know about the target that would help you respond?",
}

Return ONLY this JSON object. Do not include any other text or explanation.

JSON response:`;

    const response = await this.llm.generate(prompt, {
      temperature: 0.3,
      max_tokens: 200,
      responseFormat: psychologySchema(),
    });

    const dialectic = safeParse<Dialectic>(response.content, "psychology");
    if (!dialectic || !dialectic.target || !dialectic.question) {
      console.warn("Invalid psychology response:", response.content);
      return;
    }

    const peer = await this.honcho.peer(sanitizeUsername(dialectic.target));
    const dialecticResponse = await peer.chat(dialectic.question, {
      sessionId: sessionId || undefined,
    });
    return dialecticResponse;
  }

  async search({ message, recentContext, sessionId }: ToolContext) {
    console.log(`🔍 ${this.agentName} executing search tool...`);
    const prompt = `You are ${this.agentName} in a group chat. You want to search the conversation history to get more context on something.

Recent conversation:
${recentContext}

Latest message from ${message.username}: "${message.content}"

Decide on a semantic query to search for in the conversation history

Respond with a JSON object with this exact format:
{
 "query": Word or Phrase you want to search to get more context,
}

Return ONLY this JSON object. Do not include any additional text.

JSON response:`;

    const response = await this.llm.generate(prompt, {
      temperature: 0.3,
      max_tokens: 200,
      responseFormat: searchSchema(),
    });

    const queryPayload = safeParse<Search>(response.content, "search");
    if (!queryPayload || !queryPayload.query) {
      console.warn("Invalid search response:", response.content);
      return;
    }

    if (!sessionId) {
      console.log("⚠️ No session ID yet, skipping search");
      return;
    }

    const session = await this.honcho.session(sessionId);
    return session.search(queryPayload.query);
  }
}
