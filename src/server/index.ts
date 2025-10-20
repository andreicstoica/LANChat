import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { Honcho } from "@honcho-ai/sdk";
import type { Message, User, Agent, GameState } from "../types.js";
import { MessageType } from "../types.js";
import { createAPIRoutes } from "./api.js";
import { setupSocketIO } from "./socket.js";
import { displayStartupInfo, print } from "./utils.js";
import { spawn } from "node:child_process";

// Parse command line arguments
const args = process.argv.slice(2);
const sessionFlag = args.findIndex((arg) => arg === "--session");
const gameFlag = args.includes("--game");
const providedSessionId =
  sessionFlag !== -1 && sessionFlag + 1 < args.length
    ? args[sessionFlag + 1]
    : null;

async function startServer() {
  // Initialize Honcho
  const honcho = new Honcho({
    baseURL: process.env.HONCHO_BASE_URL || "http://localhost:8000",
    apiKey: process.env.HONCHO_API_KEY,
    workspaceId: process.env.HONCHO_WORKSPACE_ID || "default",
  });

  // Create or use existing session
  const sessionId = providedSessionId || `groupchat-${Date.now()}`;
  const session = await honcho.session(sessionId);
  print(`honcho session: ${session.id}`, "cyan");

  // Application state
  const connectedUsers = new Map<string, User>();
  const chatHistory: Message[] = [];
  const agents = new Map<string, Agent>();

  // Game state
  const gameState: GameState = {
    currentScene: "The Tavern",
    activeQuests: [],
    npcStates: new Map(),
    gameMode: gameFlag
  };

  // Load existing messages if using provided session
  if (providedSessionId) {
    print("loading existing messages from session...", "yellow");
    try {
      const existingMessagesPage = await session.getMessages();
      const existingMessages = existingMessagesPage.items;

      for (const msg of existingMessages) {
        const message: Message = {
          id: msg.id,
          type: MessageType.CHAT,
          username: msg.peer_id || "unknown",
          content: msg.content,
          metadata: {
            timestamp: msg.created_at || new Date().toISOString(),
            loadedFromSession: true,
          },
        };
        chatHistory.push(message);
      }

      print(`loaded ${existingMessages.length} messages from session`, "green");
    } catch (error) {
      print(`error loading messages from session: ${error}`, "red");
    }
  }

  // Configuration
  const PORT = parseInt(Bun.env.PORT || "3000");

  // Create API routes
  const app = createAPIRoutes(connectedUsers, agents, chatHistory, PORT, gameState);

  // Create HTTP server
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith("/api/")) {
      const response = await app.fetch(
        new Request(`http://localhost${req.url}`, {
          method: req.method,
          headers: req.headers as any,
        }),
      );

      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      const body = await response.text();
      res.end(body);
    } else {
      res.statusCode = 404;
      res.end("Not Found");
    }
  });

  // Setup Socket.IO
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingInterval: 25000,
    pingTimeout: 60000,
    transports: ["websocket", "polling"],
  });

  setupSocketIO(io, connectedUsers, agents, chatHistory, honcho, session);

  // Start game agents if in game mode
  if (gameFlag) {
    print("🎲 Starting D&D game mode...", "magenta");
    startGameAgents();
  }

  // Start server
  print("starting LAN chat server...", "blue");
  server.listen(PORT, () => {
    print(`server listening on port ${PORT}`, "green");
    displayStartupInfo(PORT);
  });
}

// Function to start game agents
function startGameAgents() {
  const serverUrl = `http://localhost:${process.env.PORT || "3000"}`;

  // Start GM agent
  const gmProcess = spawn("bun", ["run", "src/game-agents/gm-agent.ts", `--server=${serverUrl}`], {
    stdio: "inherit",
    cwd: process.cwd()
  });

  // Start friendly NPC
  const friendlyProcess = spawn("bun", ["run", "src/game-agents/friendly-npc-agent.ts", "Elderwyn", `--server=${serverUrl}`], {
    stdio: "inherit",
    cwd: process.cwd()
  });

  // Start suspicious NPC
  const suspiciousProcess = spawn("bun", ["run", "src/game-agents/suspicious-npc-agent.ts", "Thorne", `--server=${serverUrl}`], {
    stdio: "inherit",
    cwd: process.cwd()
  });

  // Start hostile NPC
  const hostileProcess = spawn("bun", ["run", "src/game-agents/hostile-npc-agent.ts", "Grimjaw", `--server=${serverUrl}`], {
    stdio: "inherit",
    cwd: process.cwd()
  });

  // Handle process cleanup
  process.on("SIGINT", () => {
    print("🎲 Shutting down game agents...", "yellow");
    gmProcess.kill();
    friendlyProcess.kill();
    suspiciousProcess.kill();
    hostileProcess.kill();
  });

  print("🎲 Game agents started: GM, Elderwyn (friendly), Thorne (suspicious), Grimjaw (hostile)", "green");
}

startServer().catch(console.error);

