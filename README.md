# LAN Chat Server with AI Agent Support

A real-time chat application built with **Bun**, **TypeScript**, and **Hono**, designed for LAN use with built-in support for AI agents and structured data processing. **Users can connect with standard Unix tools like netcat, telnet, or the provided terminal client.**

> **Frontend**: The web UI is in a separate repository: [lanchat-ui](https://github.com/yourusername/lanchat-ui)

## Features

- **Modern Stack**: Built with Bun, TypeScript, and Hono for optimal performance
- **AI Agent Integration**: Bots can join as agents with special capabilities
- **Structured Messaging**: Rich message protocol supporting different message types
- **Chat History**: Persistent message history with API access
- **Real-time Communication**: Instant message delivery via WebSockets
- **Agent Data Processing**: Agents can send/receive structured data for background processing
- **No Dependencies for Users**: LAN users can join with tools already on their system
- **Automatic Network Detection**: Server detects available IPs and provides connection guidance

## Quick Start

### 1. Install Dependencies (Bun)

```bash
bun install
```

### 2. Start the Server

```bash
bun start
# or for development with auto-restart:
bun dev
```

The server will automatically detect your network interfaces and show you exactly how to connect!

### 3. Connect Users

The server will show you exactly which IPs to use! Example output:

```
🌐 LAN Connection Commands:
   Interface: en0 (primary)
   • nc 192.168.1.105 3001
   • telnet 192.168.1.105 3001
```

**Connect using the TypeScript terminal client**

```bash
# Connect with default username
bun run client

# Connect with custom username
bun run client Alice

# Connect to remote server
bun run client Bob --server=http://192.168.1.100:3000
```

### 4. Start AI Agents

```bash
# Start an agent with default name
bun run agent

# Start with custom agent name
bun run agent SmartBot
```

## Message Types

The system supports several message types:

- **chat**: Regular user messages
- **agent_response**: AI agent responses to conversations
- **agent_data**: Structured data from agents (can be private or broadcast)
- **system**: System notifications (joins, leaves, etc.)

## Agent Capabilities

Agents can:

- **Process chat history**: Access to full conversation context
- **Analyze sentiment**: Basic sentiment analysis of messages
- **Extract topics**: Identify trending conversation topics
- **Respond to mentions**: React when directly mentioned
- **Send structured data**: Share analysis results with other agents
- **Query chat history**: Access historical messages via API

## API Endpoints

- `GET /api/stats` - Server statistics
- `GET /api/history?limit=50` - Recent chat history

## Agent Integration Examples

### Basic Agent Response

```javascript
// Agent responds to direct mentions
socket.emit("agent_response", {
  response: "I can help with that!",
  responseType: "direct_mention",
  confidence: 0.8,
});
```

### Structured Data Sharing

```javascript
// Agent shares analysis data
socket.emit("agent_data", {
  dataType: "sentiment_analysis",
  processedData: {
    sentiment: "positive",
    confidence: 0.9,
    topics: ["nodejs", "ai"],
  },
  broadcast: false, // Keep private to agents
});
```

### Querying History

```javascript
// Get recent messages
socket.emit("get_history", { limit: 100 }, (response) => {
  console.log("Recent messages:", response.history);
});
```

## Extending with Real AI

To integrate with actual AI services (like Claude), modify the `agent.js` file:

```javascript
async getAIResponse(prompt, context = {}) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Chat context: ${JSON.stringify(context)}\n\nUser message: ${prompt}`
        }
      ]
    })
  });

  const data = await response.json();
  return {
    response: data.content[0].text,
    confidence: 0.9
  };
}
```

## Terminal Commands

Both netcat and terminal clients support:

- `/help` - Show available commands
- `/users` - List connected users and agents
- `/quit` - Exit the chat

## Agent Capabilities

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Human     │    │   Server    │    │   Agent     │
│   Client    │◄──►│   Socket.io │◄──►│   Bot       │
│ (Terminal)  │    │   Express   │    │ (AI/Logic)  │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                   ┌───────▼───────┐
                   │  Chat History │
                   │   & State     │
                   └───────────────┘
```

## Deployment

### Backend (This Repo)

- **Railway**: Connect GitHub repo, auto-detects Bun
- **Fly.io**: Great for WebSocket servers, use `fly.toml`
- **Render**: Free tier available, handles WebSockets
- **VPS**: Deploy with PM2 or Docker

### Frontend (lanchat-ui repo)

- **Vercel**: Connect GitHub repo, set `VITE_API_URL` env var
- **Netlify**: Similar to Vercel, set environment variables
- **Cloudflare Pages**: Fast global CDN

### Environment Variables

```bash
# Backend
HONCHO_BASE_URL=https://api.honcho.dev/
HONCHO_API_KEY=your_api_key
HONCHO_WORKSPACE_ID=default
PORT=3000

# Frontend
VITE_API_URL=http://localhost:3000
```

## License

MIT License - feel free to modify and extend!
