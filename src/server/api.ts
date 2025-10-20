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
        currentScene: gameState.currentScene,
        activeQuests: gameState.activeQuests,
        npcStates: Array.from(gameState.npcStates.entries()).map(([name, state]) => ({
          name: state.name,
          mood: state.mood,
          location: state.location,
          trustLevel: state.trustLevel,
          lastInteraction: state.lastInteraction
        })),
        gameMode: gameState.gameMode
      });
    });

    app.get("/api/game/npcs", (c) => {
      const npcStates = Array.from(gameState.npcStates.entries()).map(([name, state]) => ({
        name: state.name,
        mood: state.mood,
        location: state.location,
        trustLevel: state.trustLevel,
        lastInteraction: state.lastInteraction
      }));
      return c.json({ npcs: npcStates });
    });

    app.post("/api/game/scene", async (c) => {
      const { scene } = await c.req.json();
      if (gameState) {
        gameState.currentScene = scene;
      }
      return c.json({ success: true, currentScene: scene });
    });

    app.get("/api/game/recap", async (c) => {
      // This would need access to the Honcho session to get the recap
      // For now, return a placeholder
      return c.json({
        recap: "Game recap functionality will be implemented with Honcho session integration",
        currentScene: gameState.currentScene,
        activeQuests: gameState.activeQuests.length
      });
    });
  }

  return app;
}