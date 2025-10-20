#!/usr/bin/env bun

import { ChatAgent } from "../agent.js";
import type { GameState, Quest } from "../types.js";

// Parse command line arguments
const args = process.argv.slice(2);
const serverArg = args.find((arg) => arg.startsWith("--server="));
const SERVER_URL = serverArg
    ? serverArg.split("=")[1]
    : Bun.env.CHAT_SERVER || "http://localhost:3000";

class GameMasterAgent extends ChatAgent {
    private gameState: GameState;
    private currentScene: string;
    private activeQuests: Quest[];

    constructor() {
        const gmPrompt = `You are Honcho the GM, the master storyteller of this D&D adventure!

Your role:
- Narrate the story and describe scenes vividly
- Manage NPCs and their interactions with players
- Track quest progress and story beats
- Create engaging encounters and challenges
- Respond to player actions with consequences

Style:
- Be descriptive and atmospheric
- Use "you" to address players directly
- Create tension and mystery
- Reward creative thinking
- Keep the story flowing

You have access to player psychology analysis - use it to tailor the story to each player's preferences and playstyle.

Remember: You are the narrator, not a character. Guide the story, don't participate in it.`;

        super("Honcho the GM", gmPrompt);

        // GM should be more selective about when to respond
        this.temperature = 0.8;
        this.responseLength = 150;

        // Initialize game state
        this.gameState = {
            currentScene: "The Tavern",
            activeQuests: [],
            npcStates: new Map(),
            gameMode: true
        };

        this.currentScene = "The Tavern";
        this.activeQuests = [];
    }

    async connect(): Promise<void> {
        console.log(`🎲 Honcho the GM is preparing the adventure at ${SERVER_URL}...`);
        await super.connect();

        // Send initial scene description
        setTimeout(() => {
            this.introduceScene();
        }, 2000);
    }

    private async introduceScene(): Promise<void> {
        const sceneDescription = `🎭 *The scene opens in a dimly lit tavern called "The Honcho's Rest". Smoke curls from a fireplace, and the sound of dice rolling on wooden tables fills the air. You find yourself seated at a corner table, where an old map is spread out before you.*

Welcome, adventurers! I am Honcho the GM, your guide through this tale. What brings you to this tavern tonight? Are you seeking adventure, information, or perhaps something more... mysterious?`;

        if (this.socket) {
            this.socket.emit("chat", {
                content: sceneDescription,
                metadata: { gameEvent: "scene_intro" }
            });
        }
    }

    private checkGameTriggers(content: string): string | null {
        const lowerContent = content.toLowerCase();

        // Scene/action triggers
        if (lowerContent.includes("look around") || lowerContent.includes("examine")) {
            return "player_examination";
        }
        if (lowerContent.includes("talk to") || lowerContent.includes("approach")) {
            return "npc_interaction";
        }
        if (lowerContent.includes("quest") || lowerContent.includes("mission")) {
            return "quest_discussion";
        }
        if (lowerContent.includes("gm") || lowerContent.includes("narrator")) {
            return "direct_gm_question";
        }
        if (lowerContent.includes("scene") || lowerContent.includes("location")) {
            return "scene_inquiry";
        }

        return null;
    }

    protected async generateResponse(
        message: any,
        recentContext: string,
        tracker: Record<string, any>
    ): Promise<void> {
        try {
            console.log(`🎭 GM generating narrative response...`);

            // Query player context for personalized narration
            const playerContext = await this.queryPlayerContext(message.username);

            const messages: Array<{ role: "system" | "user" | "assistant", content: string }> = [
                {
                    role: "system" as const,
                    content: this.systemPrompt,
                },
                {
                    role: "user" as const,
                    content: `Recent conversation and game context:
${recentContext}

Player context: ${playerContext}

${message.username} said: "${message.content}"

${tracker["psychology"] ? `Psychology analysis: ${JSON.stringify(tracker["psychology"], null, 2)}` : ""}

Respond as Honcho the GM with engaging narration. Consider the player's style and preferences from the context above.`,
                },
            ];

            const response = await this.llm.chat(messages, {
                temperature: this.temperature,
                max_tokens: this.responseLength + 50,
            });

            const responseContent = response.content?.trim();
            if (!responseContent) {
                console.error("Empty response from GM");
                return;
            }

            console.log(`🎭 GM narrating: ${responseContent.substring(0, 50)}...`);
            this.socket!.emit("chat", {
                content: responseContent,
                metadata: {
                    gameEvent: "gm_narration",
                    scene: this.currentScene
                }
            });

            // Save GM message to Honcho
            if (this.sessionId) {
                const session = await this.honcho.session(this.sessionId);
                const peer = await this.honcho.peer(this.sanitizeUsername(this.agentName));
                await session.addMessages([peer.message(responseContent)]);
            }
        } catch (error) {
            console.error("Error in GM response generation:", error);
        }
    }

    private async queryPlayerContext(username: string): Promise<string> {
        try {
            if (!this.sessionId) return "No session context available";

            const peer = await this.honcho.peer(this.sanitizeUsername(username));
            const context = await peer.chat("What is this player's preferred playstyle, communication style, and what kind of challenges do they seem to enjoy? Keep it brief.", {
                sessionId: this.sessionId
            });

            // Handle both string and DialecticStreamResponse
            const contextStr = typeof context === 'string' ? context : context?.toString() || "No specific player context available";
            return contextStr;
        } catch (error) {
            console.error("Error querying player context:", error);
            return "Error retrieving player context";
        }
    }

    // Game state management methods
    public setCurrentScene(scene: string): void {
        this.currentScene = scene;
        this.gameState.currentScene = scene;
    }

    public addQuest(quest: Quest): void {
        this.activeQuests.push(quest);
        this.gameState.activeQuests.push(quest);
    }

    public getGameState(): GameState {
        return this.gameState;
    }
}

// Only run if this file is executed directly
if (import.meta.main) {
    const gm = new GameMasterAgent();
    gm.connect().catch(console.error);

    // Handle graceful shutdown
    process.on("SIGINT", () => {
        console.log("\n🎲 Honcho the GM is ending the session...");
        gm.disconnect();
        process.exit(0);
    });
}

export { GameMasterAgent };
