import type { LLMProvider } from "../llm/interface.ts";
import type { AgentDecision, Message, ResponseDecision } from "../types.ts";
import { actionDecisionSchema, shouldRespondSchema } from "./schemas.ts";
import { normalizeDecision, safeParse } from "./utils.ts";

interface ToolHandlers {
  analyzePsychology: () => Promise<any>;
  search: () => Promise<any>;
}

interface DecisionContext {
  message: Message;
  recentContext: string;
  tracker: Record<string, any>;
  tools: ToolHandlers;
  generateResponse: (tracker: Record<string, any>) => Promise<void>;
}

export class DecisionEngine {
  constructor(
    private readonly llm: LLMProvider,
    private readonly agentName: string,
  ) { }

  async shouldRespond(message: Message, recentContext: string): Promise<ResponseDecision> {
    const prompt = `You are ${this.agentName} in a group chat. Based on the recent conversation and the latest message, decide if you should respond.

Recent conversation, summary, and/or peer information:
${recentContext}

Latest message from ${message.username}: "${message.content}"

Respond with a JSON object with this exact format:
{
  "should_respond": true or false,
  "reason": "brief explanation",
 "confidence": 0.0 to 1.0
}

STRICT CRITERIA - ONLY respond if:
- The message directly mentions your name (${this.agentName}) or @mentions you
- It's a direct question specifically asking for your expertise
- You're explicitly called upon to participate
- The message is clearly addressed to you personally

DO NOT respond if:
- The message is general discussion or world-building
- Other agents are already handling the topic
- You haven't been directly addressed
- The conversation is moving along without you
- It's just descriptive text or scene-setting

Default to staying quiet. Be very selective - most messages should result in "should_respond": false.

Return ONLY the JSON object. Do not include explanations, prefixes, or suffixes.

JSON response:`;

    const response = await this.llm.generate(prompt, {
      temperature: 0.3,
      max_tokens: 200,
      responseFormat: shouldRespondSchema(),
    });

    const decision = safeParse<ResponseDecision>(response.content, "should-respond decision");
    if (!decision) {
      console.warn("Invalid should-respond output, defaulting to respond:", response.content);
      return {
        should_respond: true,
        reason: "Fallback: invalid decision JSON",
        confidence: 0.1,
      };
    }

    return decision;
  }

  async planResponse(context: DecisionContext): Promise<void> {
    const tracker = context.tracker;
    let iterations = 0;

    while (iterations < 3) {
      iterations += 1;

      const prompt = `You are ${this.agentName} in a group chat. Based on the recent conversation and the latest message, decide if you should use one of your tools before responding, or respond directly.

Recent conversation, summary, and/or peer information:
${context.recentContext}

Latest message from ${context.message.username}: "${context.message.content}"

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

Return ONLY this JSON object. Use the lowercase words "psychology", "search", or "respond" for the decision value. Do not include explanations or any text outside the braces.

JSON response:`;

      const response = await this.llm.generate(prompt, {
        temperature: 0.3,
        max_tokens: 200,
        responseFormat: actionDecisionSchema(),
      });

      const decision = safeParse<AgentDecision>(response.content, "action decision");
      const decisionType = normalizeDecision(decision?.decision);

      if (!decision || decisionType === "unknown") {
        console.warn("Invalid or unrecognized decision, defaulting to direct response:", response?.content);
        break;
      }

      if (decisionType === "psychology" && tracker["psychology"] === undefined) {
        const psychologyResponse = await context.tools.analyzePsychology();
        tracker["psychology"] = psychologyResponse ?? null;
        if (psychologyResponse) {
          continue;
        }
      }

      if (decisionType === "search" && tracker["search"] === undefined) {
        const searchResponse = await context.tools.search();
        const messages: any[] = [];

        if (searchResponse && Array.isArray(searchResponse)) {
          messages.push(...searchResponse);
        } else if (searchResponse != null) {
          messages.push(searchResponse);
        }

        tracker["search"] = messages.length > 0 ? messages : null;
        if (messages.length > 0) {
          continue;
        }
      }

      break;
    }

    if (iterations >= 3) {
      console.warn("Decision loop reached safety limit, defaulting to response.");
    }

    // Only generate response if we have a valid decision to respond
    await context.generateResponse(tracker);
  }
}
