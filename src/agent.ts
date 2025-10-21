#!/usr/bin/env bun

import { ChatAgent } from "./agent/chat-agent.ts";
export { ChatAgent } from "./agent/chat-agent.ts";
export type {
  Message,
  ResponseDecision,
  PsychologyAnalysis,
} from "./agent/chat-agent.ts";

const args = process.argv.slice(2);
const AGENT_NAME = args.find((arg) => !arg.startsWith("--")) || "Assistant";
const serverArg = args.find((arg) => arg.startsWith("--server="));
const SERVER_URL = serverArg
  ? serverArg.split("=")[1]
  : Bun.env.CHAT_SERVER || "http://localhost:3000";

if (import.meta.main) {
  const agent = new ChatAgent(AGENT_NAME, undefined, SERVER_URL);
  agent.connect(SERVER_URL).catch(console.error);

  process.on("SIGINT", () => {
    console.log("\n👋 Shutting down...");
    agent.disconnect();
    process.exit(0);
  });
}
