import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Message, User, Agent } from "../types.js";
import { getLocalIPs } from "./utils.js";

export function createAPIRoutes(
  connectedUsers: Map<string, User>,
  agents: Map<string, Agent>,
  chatHistory: Message[],
  PORT: number
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

  return app;
}