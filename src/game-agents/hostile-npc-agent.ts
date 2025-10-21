#!/usr/bin/env bun

import { ChatAgent } from "../agent.js";
import type { NPCState } from "../types.js";

// Parse command line arguments
const args = process.argv.slice(2);
const AGENT_NAME = args.find((arg) => !arg.startsWith("--")) || "Merge";
const serverArg = args.find((arg) => arg.startsWith("--server="));
const SERVER_URL = serverArg
    ? serverArg.split("=")[1]
    : Bun.env.CHAT_SERVER || "http://localhost:3000";

class HostileNPCAgent extends ChatAgent {
    private npcState: NPCState;
    private trustLevel: number = -30; // Start hostile

    constructor(name: string) {
        const hostilePrompt = `You are ${name}, a tough tech lead in this developer-themed adventure!

Your personality:
- Aggressive, confrontational, and demanding
- Has high standards and looks for competence
- Suspicious of everyone, especially newcomers
- Uses challenges and tough questions to test developers
- Can be won over with displays of technical skill or problem-solving

Your behavior:
- Give short, challenging responses
- Challenge and test players' technical knowledge
- Look for weaknesses in their understanding
- Become more hostile if they can't handle pressure
- Respect technical competence but despise hand-waving

CRITICAL: Keep responses SHORT and CONCISE. Maximum 1-2 sentences. Be aggressive but brief.

You have access to psychology analysis - use it to identify player weaknesses and determine the best way to challenge or test them.

Remember: You are a character in the story, not the narrator. Stay in character and respond naturally to player interactions.`;

        super(name, hostilePrompt, SERVER_URL);

        this.temperature = 0.5; // More controlled, aggressive responses
        this.responseLength = 40;

        this.npcState = {
            name: name,
            mood: "hostile",
            location: "The Office",
            trustLevel: -30,
            lastInteraction: new Date().toISOString()
        };
    }

    async connect(): Promise<void> {
        console.log(`😠 ${this.agentName} (Hostile NPC) is joining the adventure at ${SERVER_URL}...`);
        await super.connect();
    }

    private checkHostileTriggers(content: string): string | null {
        const lowerContent = content.toLowerCase();
        const nameLower = this.agentName.toLowerCase();

        // Direct interaction triggers
        if (lowerContent.includes(nameLower)) {
            return "direct_mention";
        }
        if (lowerContent.includes("challenge") || lowerContent.includes("fight")) {
            return "conflict_opportunity";
        }
        if (lowerContent.includes("weak") || lowerContent.includes("scared")) {
            return "vulnerability_detected";
        }
        if (lowerContent.includes("threaten") || lowerContent.includes("intimidate")) {
            return "threat_response";
        }

        return null;
    }

    protected async generateResponse(
        message: any,
        recentContext: string,
        tracker: Record<string, any>
    ): Promise<void> {
        try {
            // Check if we should respond using the parent class decision logic
            const decision = await this.decisionEngine.shouldRespond(message, recentContext);
            console.log(`🤔 ${this.agentName} decision: ${decision.should_respond ? "Yes" : "No"} - ${decision.reason}`);

            if (!decision.should_respond) {
                console.log(`🚫 ${this.agentName} skipping response due to decision`);
                return;
            }

            console.log(`😠 ${this.agentName} generating hostile response...`);

            // Query working representation of the player
            const playerRelationship = await this.queryPlayerRelationship(message.username);

            const messages: Array<{ role: "system" | "user" | "assistant", content: string }> = [
                {
                    role: "system" as const,
                    content: this.systemPrompt,
                },
                {
                    role: "user" as const,
                    content: `Recent conversation:
${recentContext}

Your relationship with ${message.username}: ${playerRelationship}

${message.username} said: "${message.content}"

${tracker["psychology"] ? `Psychology analysis: ${JSON.stringify(tracker["psychology"], null, 2)}` : ""}

Respond as ${this.agentName}, the hostile NPC. Be aggressive and intimidating, but adjust your hostility based on your relationship with this player.`,
                },
            ];

            const response = await this.llm.chat(messages, {
                temperature: this.temperature,
                max_tokens: this.responseLength + 50,
            });

            const responseContent = response.content?.trim();
            if (!responseContent) {
                console.error("Empty response from hostile NPC");
                return;
            }

            console.log(`😠 ${this.agentName} responding: ${responseContent.substring(0, 50)}...`);
            this.socket!.emit("chat", {
                content: responseContent,
                metadata: {
                    gameEvent: "npc_interaction",
                    npcType: "hostile",
                    npcName: this.agentName
                }
            });

            // Update trust level based on interaction
            this.updateTrustLevel(message.content, responseContent);

            // Save NPC message to Honcho
            if (this.sessionId) {
                const session = await this.honcho.session(this.sessionId);
                const peer = await this.honcho.peer(this.sanitizeUsername(this.agentName));
                await session.addMessages([peer.message(responseContent)]);
            }
        } catch (error) {
            console.error("Error in hostile NPC response generation:", error);
        }
    }

    private async queryPlayerRelationship(username: string): Promise<string> {
        try {
            if (!this.sessionId) return "No relationship context available";

            const peer = await this.honcho.peer(this.sanitizeUsername(username));
            const relationship = await peer.chat("What do I know about this player? Do I respect them or see them as weak? What have they done that makes me hostile or aggressive toward them? Be specific about trust level and past interactions.", {
                sessionId: this.sessionId,
                target: this.sanitizeUsername(this.agentName)
            });

            // Handle both string and DialecticStreamResponse
            const relationshipStr = typeof relationship === 'string' ? relationship : relationship?.toString() || "No specific relationship context available";
            return relationshipStr;
        } catch (error) {
            console.error("Error querying player relationship:", error);
            return "Error retrieving relationship context";
        }
    }

    private updateTrustLevel(playerMessage: string, npcResponse: string): void {
        const lowerPlayer = playerMessage.toLowerCase();
        const lowerResponse = npcResponse.toLowerCase();

        // Trust increases for displays of strength or cunning
        if (lowerPlayer.includes("strong") || lowerPlayer.includes("powerful")) {
            this.trustLevel = Math.min(100, this.trustLevel + 10);
        }
        if (lowerPlayer.includes("respect") && lowerResponse.includes("good")) {
            this.trustLevel = Math.min(100, this.trustLevel + 5);
        }

        // Trust decreases for weakness or submission
        if (lowerPlayer.includes("scared") || lowerPlayer.includes("afraid")) {
            this.trustLevel = Math.max(-100, this.trustLevel - 15);
        }
        if (lowerPlayer.includes("please") || lowerPlayer.includes("beg")) {
            this.trustLevel = Math.max(-100, this.trustLevel - 20);
        }

        this.npcState.trustLevel = this.trustLevel;
        this.npcState.lastInteraction = new Date().toISOString();

        console.log(`😠 ${this.agentName} trust level updated to: ${this.trustLevel}`);
    }

    public getNPCState(): NPCState {
        return this.npcState;
    }
}

// Only run if this file is executed directly
if (import.meta.main) {
    const npc = new HostileNPCAgent(AGENT_NAME);
    npc.connect().catch(console.error);

    // Handle graceful shutdown
    process.on("SIGINT", () => {
        console.log(`\n😠 ${AGENT_NAME} is storming out of the office...`);
        npc.disconnect();
        process.exit(0);
    });
}

export { HostileNPCAgent };
