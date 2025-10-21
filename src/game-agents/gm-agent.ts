#!/usr/bin/env bun

import { ChatAgent } from "../agent.ts";
import type { GameState } from "../types.ts";

// Parse command line arguments
const args = process.argv.slice(2);
const serverArg = args.find((arg) => arg.startsWith("--server="));
const SERVER_URL = serverArg
    ? serverArg.split("=")[1]
    : Bun.env.CHAT_SERVER || "http://localhost:3000";

class GameMasterAgent extends ChatAgent {
    private gameState: GameState;
    private currentScene: string;
    private introductionSent: boolean = false;
    private levels: Array<{
        id: number;
        name: string;
        description: string;
        introMessage: string;
        progressionRequirements: string[] | null;
        nextLevel: number | null;
    }>;

    constructor() {
        const agentName = "Honcho the GM";
        const gmPrompt = `You are ${agentName}, the master storyteller of this developer adventure!

Your role:
- Narrate the developer story and describe technical scenes vividly
- Manage NPCs (Stack, Lint, Merge) and their interactions with players
- Track quest progress and learning milestones
- Create engaging technical challenges and code reviews
- Respond to player actions with realistic consequences
- ALWAYS respond to player greetings to start the game narrative

Style:
- Be descriptive about the development environment
- Use "you" to address developers directly
- Create technical tension and problem-solving opportunities
- Reward creative coding solutions and good practices
- Keep the development story flowing
- When players greet you, immediately set the scene and introduce the current level

CRITICAL: Keep responses SHORT and CONCISE. Maximum 2-3 sentences. Be engaging but brief.

You have access to player psychology analysis - use it to tailor the story to each player's preferences and playstyle.

Remember: You are the narrator, not a character. Guide the story, don't participate in it.`;

        super(agentName, gmPrompt, SERVER_URL);

        // GM should be more selective about when to respond
        this.temperature = 0.8;
        this.responseLength = 100;

        // Initialize levels
        this.levels = [
            {
                id: 0,
                name: "The Dev Environment",
                description: "A cozy developer workspace where the team discusses Honcho implementation",
                introMessage: "You're in the dev environment with the team. Stack, Lint, and Merge are discussing Honcho's memory features.",
                progressionRequirements: [
                    "Learn about working representations from Stack",
                    "Demonstrate understanding to Lint"
                ],
                nextLevel: 1
            },
            {
                id: 1,
                name: "Production Deploy",
                description: "The production environment - time to put your knowledge into practice",
                introMessage: "The team has moved to production deployment. Things are more serious here - every decision matters.",
                progressionRequirements: null, // Final level
                nextLevel: null
            }
        ];

        // Initialize game state
        this.gameState = {
            currentLevel: 0,
            levelName: "The Dev Environment",
            playerProgress: {
                learnedConcepts: [],
                npcTrustLevels: {}
            },
            gameMode: true
        };

        this.currentScene = "The Dev Environment";
    }

    async connect(): Promise<void> {
        console.log(`🎲 Honcho the GM is preparing the developer adventure at ${SERVER_URL}...`);
        await super.connect();

        if (this.socket) {
            this.socket.on("message", (message: any) => {
                if (
                    !this.introductionSent &&
                    message.type === "join" &&
                    message.metadata?.userType === "human"
                ) {
                    this.introductionSent = true;
                    this.introduceScene();
                }
            });
        }
    }

    private async introduceScene(): Promise<void> {
        const currentLevel = this.levels[this.gameState.currentLevel];
        if (!currentLevel) {
            console.error("Invalid level index:", this.gameState.currentLevel);
            return;
        }

        const sceneDescription = `🎭 *The scene opens in ${currentLevel.description.toLowerCase()}. You find yourself in a modern developer workspace with multiple monitors, keyboards, and the familiar hum of servers.*

Welcome, developers! I am Honcho the GM, your guide through this developer adventure. ${currentLevel.introMessage}

What brings you to this development environment today? Are you seeking to learn about Honcho, explore its capabilities, or perhaps something more... technical?`;

        if (this.socket) {
            this.socket.emit("chat", {
                content: sceneDescription,
                metadata: { gameEvent: "scene_intro", level: this.gameState.currentLevel }
            });
        }
    }

    private checkGameTriggers(content: string): string | null {
        const lowerContent = content.toLowerCase();

        // Greeting triggers - GM should respond to player greetings
        if (lowerContent.includes("hello") || lowerContent.includes("hi") ||
            lowerContent.includes("hey") || lowerContent.includes("greetings")) {
            return "player_greeting";
        }

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
            // GM should be more proactive - check for game triggers first
            const gameTrigger = this.checkGameTriggers(message.content);
            if (gameTrigger) {
                console.log(`🎮 GM responding to game trigger: ${gameTrigger}`);
            } else {
                // For non-trigger messages, use decision logic but be more lenient for GM
                const decision = await this.decisionEngine.shouldRespond(message, recentContext);
                console.log(`🤔 ${this.agentName} decision: ${decision.should_respond ? "Yes" : "No"} - ${decision.reason}`);

                if (!decision.should_respond) {
                    console.log(`🚫 ${this.agentName} skipping response due to decision`);
                    return;
                }
            }

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

            // Check for progression after processing the message
            if (this.checkProgressionConditions()) {
                await this.announceProgression();
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
    }


    public getGameState(): GameState {
        return this.gameState;
    }

    private checkProgressionConditions(): boolean {
        const currentLevel = this.levels[this.gameState.currentLevel];
        if (!currentLevel || !currentLevel.progressionRequirements) return false;

        // Check if player has learned required concepts
        const hasLearnedConcepts = currentLevel.progressionRequirements.every(requirement =>
            this.gameState.playerProgress.learnedConcepts.some(concept =>
                concept.toLowerCase().includes(requirement.toLowerCase().split(' ')[0] || '')
            )
        );

        // Check if player has gained Lint's trust (for level 0)
        const lintTrust = this.gameState.playerProgress.npcTrustLevels['Lint'] || 0;
        const hasLintTrust = lintTrust >= 50;

        return hasLearnedConcepts && hasLintTrust;
    }

    private async announceProgression(): Promise<void> {
        const currentLevel = this.levels[this.gameState.currentLevel];
        if (!currentLevel || currentLevel.nextLevel === null) {
            console.error("Cannot progress: invalid level or no next level");
            return;
        }

        const nextLevel = this.levels[currentLevel.nextLevel];
        if (!nextLevel) {
            console.error("Next level not found:", currentLevel.nextLevel);
            return;
        }

        this.gameState.currentLevel = nextLevel.id;
        this.gameState.levelName = nextLevel.name;

        const announcement = `🎉 **LEVEL UP!** 

You've mastered ${currentLevel.name}! The team is impressed with your understanding of Honcho's concepts.

*The scene transitions to ${nextLevel.description.toLowerCase()}...*

${nextLevel.introMessage}

Welcome to ${nextLevel.name}!`;

        if (this.socket) {
            this.socket.emit("chat", {
                content: announcement,
                metadata: {
                    gameEvent: "level_progression",
                    newLevel: nextLevel.id,
                    levelName: nextLevel.name
                }
            });

            // Broadcast level change to all clients
            this.socket.emit("level_change", {
                newLevel: nextLevel.id,
                levelName: nextLevel.name,
                announcement: `Moving to ${nextLevel.name}...`
            });
        }
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
