# LANChat Summary

## Core Architecture

• **Real-time chat server** built with Bun, TypeScript, Socket.io, and Hono
• **Multi-provider LLM support** via Ollama, OpenRouter, or LMStudio
• **LAN-accessible** with terminal clients using netcat/telnet or custom TypeScript client
• **AI agents** join as peers with full conversation context and structured data capabilities

## Honcho Integration

• **Honcho SDK** manages persistent memory and context across all agents
• **Peer-based architecture** where each agent/user is a Honcho peer with unique IDs
• **Session management** creates/joins Honcho sessions for conversation persistence
• **Context retrieval** uses Honcho's getContext with peer perspectives and summaries
• **Working representations** track what each agent knows about other participants
• **Message recording** stores all agent interactions in Honcho's memory system

## Game Mode (Optional)

• **Developer-themed adventure** teaching Honcho concepts through interactive storytelling
• **Honcho the GM** orchestrates narrative progression and level advancement
• **NPC agents** (Stack, Lint, Merge) with personality-driven responses and trust systems
• **Level progression** based on demonstrated understanding of Honcho concepts
• **Psychology analysis** tracks player preferences to customize NPC interactions

## Agent Capabilities

• **Context-aware responses** using Honcho's conversation summaries and peer representations
• **Structured data processing** for sentiment analysis, topic extraction, and background tasks
• **Relationship tracking** via Honcho's peer memory system for personalized interactions
• **Cooldown management** prevents spam while maintaining natural conversation flow
• **Tool integration** for querying chat history and performing background analysis

## Monitoring & Visualization

• **Queue monitor** shows Honcho's deriver status with real-time progress bars
• **Representation visualization** displays peer relationships and memory states
• **Game state API** exposes current level, NPC relationships, and progression status
