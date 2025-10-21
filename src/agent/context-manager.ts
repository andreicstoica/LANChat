import type { Honcho, Session, Peer } from "@honcho-ai/sdk";
import type { Message } from "../types.ts";
import { sanitizeUsername } from "./utils.ts";

export interface ContextResult {
  session: Session;
  senderPeer: Peer;
  recentContext: string;
  sanitizedSender: string;
  summary: string | null;
}

export class AgentContextManager {
  constructor(
    private readonly honcho: Honcho,
    private readonly agentName: string,
    private readonly agentPeerId: string,
  ) { }

  async prepareContext(sessionId: string, message: Message): Promise<ContextResult> {
    const sanitizedSender = sanitizeUsername(message.username);
    const [session, senderPeer] = await Promise.all([
      this.honcho.session(sessionId),
      this.honcho.peer(sanitizedSender)
    ]);

    const context = await session.getContext({
      summary: true,
      tokens: 1000,
      lastUserMessage: message.content,
      peerTarget: sanitizedSender,
      peerPerspective: this.agentPeerId,
    });

    const openAIContext = context.toOpenAI(this.agentPeerId);
    const summary = context.summary?.content ?? null;
    const peerRepresentation = context.peerRepresentation ?? null;
    const peerCard = Array.isArray(context.peerCard) ? context.peerCard : null;

    const transcript = openAIContext
      .filter((entry) => entry.role !== "system")
      .map((entry) => {
        const speaker = entry.role === "assistant"
          ? this.agentName
          : entry.name ?? entry.role;
        return `${speaker}: ${entry.content}`;
      })
      .join("\n");

    const systemSections: string[] = [];
    if (summary?.trim()) {
      systemSections.push(`Conversation Summary:\n${summary.trim()}`);
    }
    if (peerRepresentation?.trim()) {
      systemSections.push(`Peer Representation (${this.agentName}'s perspective):\n${peerRepresentation.trim()}`);
    }
    if (peerCard && peerCard.length > 0) {
      systemSections.push(`Peer Card Details:\n${peerCard.join("\n")}`);
    }

    const recentContext = [
      ...systemSections,
      transcript ? `Recent Transcript:\n${transcript}` : null,
    ]
      .filter((section): section is string => Boolean(section))
      .join("\n\n") || "No prior context available.";

    return {
      session,
      senderPeer,
      recentContext,
      sanitizedSender,
      summary,
    };
  }

  async recordAgentMessage(sessionId: string, content: string): Promise<void> {
    const [session, agentPeer] = await Promise.all([
      this.honcho.session(sessionId),
      this.honcho.peer(this.agentPeerId)
    ]);
    await session.addMessages([agentPeer.message(content)]);
    console.log(`📝 Agent message recorded: ${this.agentName} (${this.agentPeerId}) -> ${sessionId}`);
  }
}
