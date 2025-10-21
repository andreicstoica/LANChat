import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Message, User, Agent, GameState, NPCState } from "../types.js";
import { getLocalIPs } from "./utils.js";

export function createAPIRoutes(
  connectedUsers: Map<string, User>,
  agents: Map<string, Agent>,
  chatHistory: Message[],
  PORT: number,
  gameState?: GameState
) {
  const app = new Hono();

  app.use('/api/*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  }));

  app.get("/api/stats", (c) => {
    return c.json({
      connectedUsers: connectedUsers.size,
      connectedAgents: agents.size,
      totalMessages: chatHistory.length,
      uptime: process.uptime(),
    });
  });

  app.get("/api/history", (c) => {
    const limit = parseInt(c.req.query("limit") || "50");
    return c.json({
      messages: chatHistory.slice(-limit),
    });
  });

  app.get("/api/network", (c) => {
    return c.json({
      interfaces: getLocalIPs(),
      ports: {
        socketio: PORT,
      },
    });
  });

  // Game-specific endpoints
  if (gameState) {
    app.get("/api/game/state", (c) => {
      return c.json({
        // Level info
        currentLevel: gameState.currentLevel,
        levelName: gameState.levelName,
        isFinalLevel: gameState.currentLevel === 1,

        // Player progress
        learnedConcepts: gameState.playerProgress.learnedConcepts,
        npcTrustLevels: gameState.playerProgress.npcTrustLevels,

        // Level descriptions for UI
        levelDescriptions: {
          0: {
            name: "The Dev Environment",
            description: "A cozy developer workspace where the team discusses Honcho implementation",
            objectives: [
              "Learn about working representations from Stack",
              "Demonstrate understanding to Lint"
            ]
          },
          1: {
            name: "Production Deploy",
            description: "The production environment - time to put your knowledge into practice",
            objectives: [
              "Apply Honcho concepts in production",
              "Master advanced Honcho features"
            ]
          }
        },

        // NPC info for UI
        npcs: [
          { name: "Stack", role: "Senior Developer", personality: "Helpful mentor" },
          { name: "Lint", role: "Code Reviewer", personality: "Quality-focused" },
          { name: "Merge", role: "Tech Lead", personality: "Challenging but fair" }
        ],

        gameMode: gameState.gameMode
      });
    });

    // Simplified - only keep essential endpoints for UI
  }

  return app;
}