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
  summary?: string | null;
}

export class DecisionEngine {
  constructor(
    private readonly llm: LLMProvider,
    private readonly agentName: string,
  ) { }

  async shouldRespond(
    message: Message,
    recentContext: string,
    summary?: string | null,
  ): Promise<ResponseDecision> {
    // Use LLM with proper schema to make intelligent decisions about when to respond
    const summarySection = summary && summary.trim().length > 0
      ? summary.trim()
      : "No summary available.";
    const transcriptSection = recentContext && recentContext.trim().length > 0
      ? recentContext.trim()
      : "No recent transcript available.";
    const senderType = message.metadata?.userType ?? "unknown";
    const prompt = `You are ${this.agentName}, a character in a roleplay game. Analyze if you should respond to this message.

Conversation summary:
${summarySection}

Recent conversation transcript:
${transcriptSection}

New message from ${message.username}: "${message.content}"
Sender type: ${senderType}

Should you respond? Consider:
1. Are you directly mentioned by name?
2. Are you being asked a question?
3. Is the message responding to something you said?
4. Is the message relevant to your role and expertise?
5. Would it be natural for you to contribute to this conversation?
6. Only respond to other agents if they explicitly ask for your input or coordination is required.`;

    try {
      const response = await this.llm.chat([
        { role: "system", content: "You are a decision-making assistant. Always respond with valid JSON matching the required schema." },
        { role: "user", content: prompt }
      ], {
        format: "json",
        temperature: 0.3,
        responseFormat: shouldRespondSchema(),
      });

      const parsed = JSON.parse(response.content);

      // Validate the response structure
      if (typeof parsed.should_respond === 'boolean' &&
        typeof parsed.reason === 'string' &&
        typeof parsed.confidence === 'number') {
        return {
          should_respond: parsed.should_respond,
          reason: parsed.reason,
          confidence: Math.max(0.0, Math.min(1.0, parsed.confidence))
        };
      }
    } catch (error) {
      console.error(`Error in LLM decision for ${this.agentName}:`, error);
    }

    // Fallback to simple heuristics if LLM fails
    const content = message.content.toLowerCase();
    const agentNameLower = this.agentName.toLowerCase();

    if (content.includes(agentNameLower) || content.includes(`@${agentNameLower}`)) {
      return {
        should_respond: true,
        reason: "Directly mentioned by name (fallback)",
        confidence: 0.9,
      };
    }

    return {
      should_respond: false,
      reason: "No clear reason to respond (fallback)",
      confidence: 0.5,
    };
  }

  async planResponse(context: DecisionContext): Promise<void> {
    const tracker = context.tracker;
    const summarySection = context.summary && context.summary.trim().length > 0
      ? context.summary.trim()
      : "No summary available.";
    const transcriptSection = context.recentContext && context.recentContext.trim().length > 0
      ? context.recentContext.trim()
      : "No recent transcript available.";

    // Use LLM to decide what tools to use before responding
    const prompt = `You are ${this.agentName}. Review the Honcho-provided summary and transcript, then decide what actions to take before responding.

Conversation summary:
${summarySection}

Recent transcript:
${transcriptSection}

New message: "${context.message.content}"

Available tools:
1. analyzePsychology - Analyze the psychology/motivation of another character
2. search - Search for information in the conversation history

Guidelines:
- Use search when the summary or transcript lacks the detail you need.
- Use psychology when understanding motivations or relationships would help craft the response.
- Only respond directly when you are confident you have enough context.

Choose your action and provide reasoning.`;

    try {
      const response = await this.llm.chat([
        { role: "system", content: "You are a decision-making assistant. Always respond with valid JSON matching the required schema." },
        { role: "user", content: prompt }
      ], {
        format: "json",
        temperature: 0.3,
        responseFormat: actionDecisionSchema(),
      });

      const parsed = safeParse<AgentDecision>(response.content, `${this.agentName} tool decision`);

      if (parsed) {
        const rawDecision = typeof parsed.decision === "string" ? parsed.decision.trim() : "";
        const rawReason = typeof parsed.reason === "string" ? parsed.reason.trim() : "";

        const decisionLabel = rawDecision.length > 0 ? rawDecision : "respond";
        const reason = rawReason.length > 0 ? rawReason : "No reason provided";

        if (rawDecision.length === 0 || rawReason.length === 0) {
          console.warn(`⚠️ ${this.agentName} tool decision missing fields. Raw response:`, response.content);
        }

        console.log(`🤔 ${this.agentName} tool decision: ${decisionLabel} - ${reason}`);

        // Execute the decided tool action
        const decision = normalizeDecision(decisionLabel);
        if (decision === "psychology" && context.tools.analyzePsychology) {
          const psychologyResult = await context.tools.analyzePsychology();
          if (psychologyResult != null) {
            context.tracker["psychology"] = psychologyResult;
          }
        } else if (decision === "search" && context.tools.search) {
          const searchResult = await context.tools.search();
          if (searchResult != null) {
            context.tracker["search"] = searchResult;
          }
        }
      } else {
        console.log(`🤔 ${this.agentName} tool decision: respond - Failed to parse tool decision`);
      }
    } catch (error) {
      console.error(`Error in tool decision for ${this.agentName}:`, error);
      console.log(`🤔 ${this.agentName} tool decision: respond - Skipping tool analysis due to error`);
    }

    // Generate response after tool analysis
    await context.generateResponse(tracker);
  }
}
