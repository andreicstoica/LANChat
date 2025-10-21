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
    // Fast heuristic-based decision to reduce LLM calls
    const content = message.content.toLowerCase();
    const agentNameLower = this.agentName.toLowerCase();

    // Direct name mentions
    if (content.includes(agentNameLower) || content.includes(`@${agentNameLower}`)) {
      return {
        should_respond: true,
        reason: "Directly mentioned by name",
        confidence: 0.9,
      };
    }

    // Direct questions (simple heuristic)
    if (content.includes('?') && (content.includes('how') || content.includes('what') || content.includes('why') || content.includes('when') || content.includes('where'))) {
      return {
        should_respond: true,
        reason: "Direct question detected",
        confidence: 0.7,
      };
    }

    // Default to not responding for most messages
    return {
      should_respond: false,
      reason: "No direct mention or clear question",
      confidence: 0.8,
    };
  }

  async planResponse(context: DecisionContext): Promise<void> {
    const tracker = context.tracker;

    // Simplified: skip tool decisions for now to reduce LLM calls
    // Most responses should be direct without additional analysis
    console.log(`🤔 ${this.agentName} tool decision: respond - Skipping tool analysis for faster response`);

    // Only generate response if we have a valid decision to respond
    await context.generateResponse(tracker);
  }
}
