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
const gameFlag =
  args.includes("--game") ||
  Bun.env.GAME_MODE === "true" ||
  process.env.GAME_MODE === "true";
const providedSessionId =
  sessionFlag !== -1 && sessionFlag + 1 < args.length
    ? args[sessionFlag + 1]
    : null;

async function startServer() {
  // Initialize Honcho
  const honcho = new Honcho({
    baseURL: process.env.HONCHO_BASE_URL || "http://localhost:8000",
    apiKey: process.env.HONCHO_API_KEY,
    workspaceId: process.env.HONCHO_WORKSPACE_ID || "lanchat-dev",
  });

  // Create or use existing session
  const sessionId = providedSessionId || `groupchat-${Date.now()}`;
  let session = await honcho.session(sessionId);
  print(`honcho session: ${session.id}`, "cyan");

  // Application state
  const connectedUsers = new Map<string, User>();
  const chatHistory: Message[] = [];
  const agents = new Map<string, Agent>();
  const getSession = () => session;
  let io: SocketIOServer | null = null;
  let isRestarting = false;

  // Game state
  const gameState: GameState = {
    currentLevel: 0,
    levelName: "The Dev Environment",
    playerProgress: {
      learnedConcepts: [],
      npcTrustLevels: {}
    },
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

  const resetGameState = () => {
    gameState.currentLevel = 0;
    gameState.levelName = "The Dev Environment";
    gameState.playerProgress.learnedConcepts = [];
    gameState.playerProgress.npcTrustLevels = {};
  };

  const restartService = async () => {
    if (isRestarting) {
      throw new Error("Restart already in progress");
    }

    isRestarting = true;
    print("♻️  Restart requested via API...", "magenta");

    try {
      const currentSession = session;
      const currentWorkspaceId = honcho.workspaceId;

      // Disconnect all sockets and clear state
      if (io) {
        io.sockets.sockets.forEach((socket) => {
          try {
            socket.disconnect(true);
          } catch (err) {
            print(`⚠️  Error disconnecting socket: ${err}`, "yellow");
          }
        });
      }

      connectedUsers.clear();
      agents.clear();
      chatHistory.length = 0;
      resetGameState();

      // Create new workspace for fresh restart
      const newWorkspaceId = `lanchat-${Date.now()}`;
      const newHoncho = new Honcho({
        baseURL: process.env.HONCHO_BASE_URL || "http://localhost:8000",
        apiKey: process.env.HONCHO_API_KEY,
        workspaceId: newWorkspaceId,
      });

      const newSessionId = `groupchat-${Date.now()}`;
      session = await newHoncho.session(newSessionId);

      // Update the honcho instance used by socket handlers
      Object.assign(honcho, newHoncho);

      // Notify all connected clients about the new workspace
      if (io) {
        io.emit("workspace_info", { workspaceId: newWorkspaceId });
        io.emit("session_id", session.id);
      }

      print(`✅ Restart complete. New workspace: ${newWorkspaceId}, session: ${session.id}`, "green");
      return { sessionId: session.id, workspaceId: newWorkspaceId };
    } finally {
      isRestarting = false;
    }
  };

  // Create API routes
  const app = createAPIRoutes(connectedUsers, agents, chatHistory, PORT, gameState, { onRestart: restartService });

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
  const ioServer = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingInterval: 25000,
    pingTimeout: 60000,
    transports: ["websocket", "polling"],
  });

  io = ioServer;
  setupSocketIO(ioServer, connectedUsers, agents, chatHistory, honcho, getSession);

  // Start server
  print("starting LAN chat server...", "blue");
  server.listen(PORT, () => {
    print(`server listening on port ${PORT}`, "green");
    displayStartupInfo(PORT);

    // Start game agents after the server is ready
    if (gameFlag) {
      print("🎲 Starting D&D game mode...", "magenta");
      print("💡 Press Ctrl+C to stop all processes gracefully", "cyan");
      startGameAgents();
    }
  });
}

// Track all spawned processes for cleanup
const spawnedProcesses: any[] = [];
let isShuttingDown = false;

// Function to start game agents
function startGameAgents() {
  const serverUrl = `http://localhost:${process.env.PORT || "3000"}`;

  const agentConfigs = [
    { name: "GM", script: "src/game-agents/gm-agent.ts", args: [`--server=${serverUrl}`] },
    { name: "Stack (friendly)", script: "src/game-agents/friendly-npc-agent.ts", args: ["Stack", `--server=${serverUrl}`] },
    { name: "Lint (suspicious)", script: "src/game-agents/suspicious-npc-agent.ts", args: ["Lint", `--server=${serverUrl}`] },
    { name: "Merge (hostile)", script: "src/game-agents/hostile-npc-agent.ts", args: ["Merge", `--server=${serverUrl}`] }
  ];

  agentConfigs.forEach((config, index) => {
    const childProcess = spawn("bun", ["run", config.script, ...config.args], {
      stdio: "inherit",
      cwd: process.cwd(),
      detached: false
    });

    // Add process metadata
    (childProcess as any).agentName = config.name;
    (childProcess as any).agentIndex = index;

    spawnedProcesses.push(childProcess);

    // Handle process exit
    childProcess.on('exit', (code: number | null, signal: string | null) => {
      if (!isShuttingDown) {
        print(`⚠️  ${config.name} agent exited with code ${code} (signal: ${signal})`, "yellow");
      }
    });

    childProcess.on('error', (error: Error) => {
      if (!isShuttingDown) {
        print(`❌ Error starting ${config.name} agent: ${error.message}`, "red");
      }
    });
  });

  print("🎲 Game agents started: GM, Stack (friendly), Lint (suspicious), Merge (hostile)", "green");

  // Monitor process health
  setInterval(() => {
    if (!isShuttingDown) {
      const deadProcesses = spawnedProcesses.filter(proc => proc.killed);
      if (deadProcesses.length > 0) {
        print(`⚠️  ${deadProcesses.length} game agent(s) have died. Consider restarting.`, "yellow");
      }
    }
  }, 10000); // Check every 10 seconds
}

// Comprehensive cleanup handler for all processes
function setupCleanupHandlers() {
  const cleanup = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    print("\n🛑 Shutting down all processes...", "yellow");

    // Create cleanup promises for all processes
    const cleanupPromises = spawnedProcesses.map(async (proc, index) => {
      if (proc && !proc.killed) {
        const agentName = (proc as any).agentName || `Process ${index + 1}`;
        print(`🔄 Stopping ${agentName}...`, "cyan");

        try {
          // Try graceful shutdown first
          proc.kill("SIGTERM");

          // Wait for graceful shutdown
          await new Promise((resolve) => {
            const timeout = setTimeout(() => {
              if (!proc.killed) {
                print(`⚡ Force killing ${agentName}...`, "red");
                proc.kill("SIGKILL");
              }
              resolve(true);
            }, 1500);

            proc.on('exit', () => {
              clearTimeout(timeout);
              resolve(true);
            });
          });

          print(`✅ ${agentName} stopped`, "green");
        } catch (error) {
          print(`❌ Error stopping ${agentName}: ${error}`, "red");
        }
      }
    });

    // Wait for all processes to be cleaned up
    await Promise.all(cleanupPromises);

    // Additional cleanup: kill any remaining bun processes related to the game
    try {
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);

      // Kill any remaining game-related processes
      await execAsync("pkill -f 'bun.*src/game-agents' || true");
      await execAsync("pkill -f 'bun.*src/server.*--game' || true");
    } catch (error) {
      // Ignore errors in system cleanup
    }

    print("🎯 All processes terminated. Goodbye!", "green");
    process.exit(0);
  };

  // Handle Ctrl+C (SIGINT)
  process.on("SIGINT", cleanup);

  // Handle termination signals
  process.on("SIGTERM", cleanup);

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    print(`💥 Uncaught exception: ${error.message}`, "red");
    cleanup();
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    print(`💥 Unhandled rejection: ${reason}`, "red");
    cleanup();
  });
}

// Setup cleanup handlers
setupCleanupHandlers();

startServer().catch(console.error);
