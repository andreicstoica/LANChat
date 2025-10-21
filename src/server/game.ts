#!/usr/bin/env bun

// Game mode entry point
process.argv.push("--game");

// Import and start the server
import "./index.ts";
