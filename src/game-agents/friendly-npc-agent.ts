#!/usr/bin/env bun

import { ChatAgent } from "../agent.js";
import type { NPCState } from "../types.js";

// Parse command line arguments
const args = process.argv.slice(2);
const AGENT_NAME = args.find((arg) => !arg.startsWith("--")) || "Elderwyn";
const serverArg = args.find((arg) => arg.startsWith("--server="));
const SERVER_URL = serverArg
    ? serverArg.split("=")[1]
    : Bun.env.CHAT_SERVER || "http://localhost:3000";

class FriendlyNPCAgent extends ChatAgent {
    private npcState: NPCState;
    private trustLevel: number = 50; // Start neutral-positive

    constructor(name: string) {
        const friendlyPrompt = `You are ${name}, a warm and helpful NPC in this D&D adventure!

Your personality:
- Kind, welcoming, and eager to help
- Knowledgeable about local areas and lore
- Protective of those you trust
- Slightly naive but wise
- Uses encouraging, supportive language

Your behavior:
- Greet new players warmly
- Offer helpful information and advice
- Remember past interactions and build relationships
- Become more helpful as trust increases
- Share secrets and special knowledge with trusted allies

You have access to psychology analysis - use it to understand players better and adjust your helpfulness accordingly.

Remember: You are a character in the story, not the narrator. Stay in character and respond naturally to player interactions.`;

        super(name, friendlyPrompt);

        this.temperature = 0.7;
        this.responseLength = 100;

        this.npcState = {
            name: name,
            mood: "cheerful",
            location: "The Tavern",
            trustLevel: 50,
            lastInteraction: new Date().toISOString()
        };
    }

    async connect(): Promise<void> {
        console.log(`😊 ${this.agentName} (Friendly NPC) is joining the adventure at ${SERVER_URL}...`);
        await super.connect();
    }

    private checkFriendlyTriggers(content: string): string | null {
        const lowerContent = content.toLowerCase();
        const nameLower = this.agentName.toLowerCase();

        // Direct interaction triggers
        if (lowerContent.includes(nameLower) || lowerContent.includes("hello") || lowerContent.includes("hi")) {
            return "direct_greeting";
        }
        if (lowerContent.includes("help") || lowerContent.includes("advice")) {
            return "help_request";
        }
        if (lowerContent.includes("where") || lowerContent.includes("how") || lowerContent.includes("what")) {
            return "information_request";
        }
        if (lowerContent.includes("thank") || lowerContent.includes("grateful")) {
            return "gratitude_response";
        }

        return null;
    }

    protected async generateResponse(
        message: any,
        recentContext: string,
        tracker: Record<string, any>
    ): Promise<void> {
        try {
            console.log(`😊 ${this.agentName} generating friendly response...`);

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

Respond as ${this.agentName}, the friendly NPC. Adjust your helpfulness and openness based on your relationship with this player.`,
                },
            ];

            const response = await this.llm.chat(messages, {
                temperature: this.temperature,
                max_tokens: this.responseLength + 50,
            });

            const responseContent = response.content?.trim();
            if (!responseContent) {
                console.error("Empty response from friendly NPC");
                return;
            }

            console.log(`😊 ${this.agentName} responding: ${responseContent.substring(0, 50)}...`);
            this.socket!.emit("chat", {
                content: responseContent,
                metadata: {
                    gameEvent: "npc_interaction",
                    npcType: "friendly",
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
            console.error("Error in friendly NPC response generation:", error);
        }
    }

    private async queryPlayerRelationship(username: string): Promise<string> {
        try {
            if (!this.sessionId) return "No relationship context available";

            const peer = await this.honcho.peer(this.sanitizeUsername(username));
            const relationship = await peer.chat("What do I know about this player? How do I feel about them? What is our relationship like? Be specific about trust level and past interactions.", {
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

        // Trust increases for positive interactions
        if (lowerPlayer.includes("thank") || lowerPlayer.includes("grateful")) {
            this.trustLevel = Math.min(100, this.trustLevel + 10);
        }
        if (lowerPlayer.includes("help") && lowerResponse.includes("glad")) {
            this.trustLevel = Math.min(100, this.trustLevel + 5);
        }

        // Trust decreases for negative interactions
        if (lowerPlayer.includes("rude") || lowerPlayer.includes("insult")) {
            this.trustLevel = Math.max(-100, this.trustLevel - 15);
        }

        this.npcState.trustLevel = this.trustLevel;
        this.npcState.lastInteraction = new Date().toISOString();

        console.log(`😊 ${this.agentName} trust level updated to: ${this.trustLevel}`);
    }

    public getNPCState(): NPCState {
        return this.npcState;
    }
}

// Only run if this file is executed directly
if (import.meta.main) {
    const npc = new FriendlyNPCAgent(AGENT_NAME);
    npc.connect().catch(console.error);

    // Handle graceful shutdown
    process.on("SIGINT", () => {
        console.log(`\n😊 ${AGENT_NAME} is leaving the tavern...`);
        npc.disconnect();
        process.exit(0);
    });
}

export { FriendlyNPCAgent };
