import type { Honcho, Session, Peer } from "@honcho-ai/sdk";
import type { Message } from "../types.ts";
import { sanitizeUsername } from "./utils.ts";

export interface ContextResult {
  session: Session;
  senderPeer: Peer;
  recentContext: string;
  sanitizedSender: string;
}

export class AgentContextManager {
  constructor(
    private readonly honcho: Honcho,
    private readonly agentName: string,
    private readonly agentPeerId: string,
  ) { }

  async prepareContext(sessionId: string, message: Message): Promise<ContextResult> {
    const sanitizedSender = sanitizeUsername(message.username);
    const session = await this.honcho.session(sessionId);
    const senderPeer = await this.honcho.peer(sanitizedSender);

    const context = await session.getContext({
      summary: true,
      tokens: 5000,
      lastUserMessage: message.content,
      peerTarget: sanitizedSender,
      peerPerspective: this.agentPeerId,
    });

    const recentContext = context.toOpenAI(this.agentName).join("\n");
    await session.addMessages([senderPeer.message(message.content)]);
    console.log(`📝 User message recorded: ${message.username} (${sanitizedSender}) -> ${sessionId}`);

    return {
      session,
      senderPeer,
      recentContext,
      sanitizedSender,
    };
  }

  async recordAgentMessage(sessionId: string, content: string): Promise<void> {
    const session = await this.honcho.session(sessionId);
    const agentPeer = await this.honcho.peer(this.agentPeerId);
    await session.addMessages([agentPeer.message(content)]);
    console.log(`📝 Agent message recorded: ${this.agentName} (${this.agentPeerId}) -> ${sessionId}`);
  }
}
