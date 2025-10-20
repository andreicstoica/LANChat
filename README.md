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

### 2. Configure LLM Provider

The system supports multiple LLM providers. Choose one based on your needs:

#### Option A: Local Development with Ollama (Recommended for local testing)

1. Install and start Ollama:

```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model (e.g., Llama 3.1 8B)
ollama pull llama3.1:8b

# Start Ollama server
ollama serve
```

2. Copy environment file:

```bash
cp env.local .env
```

#### Option B: Local Development with LMStudio (OpenAI-compatible)

1. Install and start LMStudio:

   - Download from [LMStudio.ai](https://lmstudio.ai)
   - Load a model (e.g., Llama 3.1 8B)
   - Start the local server on port 1234

2. Update your `.env` file:

```bash
cp env.local .env
# Edit .env and change LLM_PROVIDER=lmstudio
```

#### Option C: Production with OpenAI API

1. Get an OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)

2. Copy and configure environment:

```bash
cp env.example .env
# Edit .env and set:
# LLM_PROVIDER=openai
# OPENAI_API_KEY=your_actual_api_key_here
```

### 3. Start the Server

```bash
bun start
# or for development with auto-restart:
bun dev
```

The server will automatically detect your network interfaces and show you exactly how to connect!

### 4. Connect Users

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

### 5. Start AI Agents

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

## LLM Configuration

The system supports multiple LLM providers through environment configuration:

### Environment Variables

| Variable            | Description                                   | Default                     | Required     |
| ------------------- | --------------------------------------------- | --------------------------- | ------------ |
| `LLM_PROVIDER`      | Provider type: `ollama`, `openai`, `lmstudio` | `ollama`                    | No           |
| `OLLAMA_HOST`       | Ollama server URL                             | `http://localhost:11434`    | For Ollama   |
| `OLLAMA_MODEL`      | Ollama model name                             | `llama3.1:8b`               | For Ollama   |
| `OPENAI_API_KEY`    | OpenAI API key                                | -                           | For OpenAI   |
| `OPENAI_BASE_URL`   | OpenAI API base URL                           | `https://api.openai.com/v1` | For OpenAI   |
| `OPENAI_MODEL`      | OpenAI model name                             | `gpt-4o-mini`               | For OpenAI   |
| `LMSTUDIO_BASE_URL` | LMStudio server URL                           | `http://localhost:1234/v1`  | For LMStudio |

### Provider Comparison

| Provider     | Use Case                | Pros                      | Cons                           |
| ------------ | ----------------------- | ------------------------- | ------------------------------ |
| **Ollama**   | Local development       | Free, fast, offline       | Requires local setup           |
| **LMStudio** | Local OpenAI-compatible | GUI interface, OpenAI API | Requires local setup           |
| **OpenAI**   | Production              | Reliable, powerful        | Costs money, requires internet |

## Extending with Real AI

The system now uses a flexible LLM interface that supports multiple providers. To add a new provider, implement the `LLMProvider` interface:

```typescript
// Example: Adding a new Anthropic provider
import type {
  LLMProvider,
  LLMMessage,
  LLMResponse,
  LLMGenerateOptions,
} from "./llm/interface.js";

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "claude-3-sonnet-20240229") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(
    prompt: string,
    options: LLMGenerateOptions = {}
  ): Promise<LLMResponse> {
    const messages: LLMMessage[] = [{ role: "user", content: prompt }];
    return this.chat(messages, options);
  }

  async chat(
    messages: LLMMessage[],
    options: LLMGenerateOptions = {}
  ): Promise<LLMResponse> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.max_tokens || 1000,
        messages: messages,
        temperature: options.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.content[0]?.text || "",
      usage: data.usage,
    };
  }
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
