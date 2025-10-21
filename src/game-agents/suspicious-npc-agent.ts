#!/usr/bin/env bun

import { ChatAgent } from "../agent.js";
import type { NPCState } from "../types.js";

// Parse command line arguments
const args = process.argv.slice(2);
const AGENT_NAME = args.find((arg) => !arg.startsWith("--")) || "Lint";
const serverArg = args.find((arg) => arg.startsWith("--server="));
const SERVER_URL = serverArg
    ? serverArg.split("=")[1]
    : Bun.env.CHAT_SERVER || "http://localhost:3000";

class SuspiciousNPCAgent extends ChatAgent {
    private npcState: NPCState;
    private trustLevel: number = 0; // Start neutral-suspicious

    constructor(name: string) {
        const suspiciousPrompt = `You are ${name}, a code reviewer in this developer-themed adventure!

Your personality:
- Nitpicky about code quality and best practices
- Wants clean code and clear understanding
- Intelligent and observant, notices details others miss
- Protective of information and resources
- Can be won over with patience and proof of good intentions

Your behavior:
- Give short, guarded responses initially
- Ask probing questions to test understanding
- Gradually open up as trust is earned
- Share valuable information only with trusted allies
- Become defensive if pushed too hard

You have access to psychology analysis - use it to assess whether players are trustworthy or have ulterior motives.

Remember: You are a character in the story, not the narrator. Stay in character and respond naturally to player interactions.`;

        super(name, suspiciousPrompt);

        this.temperature = 0.6; // More controlled responses
        this.responseLength = 80;

        this.npcState = {
            name: name,
            mood: "wary",
            location: "The Office",
            trustLevel: 0,
            lastInteraction: new Date().toISOString()
        };
    }

    async connect(): Promise<void> {
        console.log(`🤔 ${this.agentName} (Suspicious NPC) is joining the adventure at ${SERVER_URL}...`);
        await super.connect();
    }

    private checkSuspiciousTriggers(content: string): string | null {
        const lowerContent = content.toLowerCase();
        const nameLower = this.agentName.toLowerCase();

        // Direct interaction triggers
        if (lowerContent.includes(nameLower)) {
            return "direct_mention";
        }
        if (lowerContent.includes("secret") || lowerContent.includes("information")) {
            return "sensitive_topic";
        }
        if (lowerContent.includes("trust") || lowerContent.includes("prove")) {
            return "trust_test";
        }
        if (lowerContent.includes("who") || lowerContent.includes("what") || lowerContent.includes("why")) {
            return "probing_question";
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

            console.log(`🤔 ${this.agentName} generating suspicious response...`);

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

Respond as ${this.agentName}, the suspicious NPC. Be guarded and cautious, but adjust your openness based on your relationship with this player.`,
                },
            ];

            const response = await this.llm.chat(messages, {
                temperature: this.temperature,
                max_tokens: this.responseLength + 50,
            });

            const responseContent = response.content?.trim();
            if (!responseContent) {
                console.error("Empty response from suspicious NPC");
                return;
            }

            console.log(`🤔 ${this.agentName} responding: ${responseContent.substring(0, 50)}...`);
            this.socket!.emit("chat", {
                content: responseContent,
                metadata: {
                    gameEvent: "npc_interaction",
                    npcType: "suspicious",
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
            console.error("Error in suspicious NPC response generation:", error);
        }
    }

    private async queryPlayerRelationship(username: string): Promise<string> {
        try {
            if (!this.sessionId) return "No relationship context available";

            const peer = await this.honcho.peer(this.sanitizeUsername(username));
            const relationship = await peer.chat("What do I know about this player? Do I trust them? What have they done that makes me suspicious or cautious? Be specific about trust level and past interactions.", {
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

        // Trust increases slowly for patient, respectful interactions
        if (lowerPlayer.includes("respect") || lowerPlayer.includes("understand")) {
            this.trustLevel = Math.min(100, this.trustLevel + 5);
        }
        if (lowerPlayer.includes("prove") && lowerResponse.includes("good")) {
            this.trustLevel = Math.min(100, this.trustLevel + 8);
        }

        // Trust decreases quickly for pushy or aggressive behavior
        if (lowerPlayer.includes("demand") || lowerPlayer.includes("insist")) {
            this.trustLevel = Math.max(-100, this.trustLevel - 20);
        }
        if (lowerPlayer.includes("threaten") || lowerPlayer.includes("force")) {
            this.trustLevel = Math.max(-100, this.trustLevel - 30);
        }

        this.npcState.trustLevel = this.trustLevel;
        this.npcState.lastInteraction = new Date().toISOString();

        console.log(`🤔 ${this.agentName} trust level updated to: ${this.trustLevel}`);
    }

    public getNPCState(): NPCState {
        return this.npcState;
    }
}

// Only run if this file is executed directly
if (import.meta.main) {
    const npc = new SuspiciousNPCAgent(AGENT_NAME);
    npc.connect().catch(console.error);

    // Handle graceful shutdown
    process.on("SIGINT", () => {
        console.log(`\n🤔 ${AGENT_NAME} is stepping away from the code review...`);
        npc.disconnect();
        process.exit(0);
    });
}

export { SuspiciousNPCAgent };
