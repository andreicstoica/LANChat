#!/usr/bin/env bun

// Game mode entry point
process.argv.push("--game");
process.env.GAME_MODE = "true";

// Import and start the server
await import("./index.ts");
