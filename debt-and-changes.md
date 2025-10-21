# Tech Debt I've Come Across

# README.md / General Setup

- No clear instruction to start local Honcho containerized server before running the demo (following instructions just gets you a connection error)
- Different env.example vs env.template -> template is the proper one to follow because it mentions a honcho base url
- found some API key errors trying to hit the Honcho server upon start (missing in server's `index.ts` file and commented out in the `agent.ts` file)
- No clear explanation of AI/LLM server setup in README.md -> currently configured for local Ollama model but not documented

# Agent Bugs

## Critical Registration Issues

- Agents registered as `type: "user"` instead of `type: "agent"` - server never added them to agents map, breaking `/api/users`, `agent_data` events, and capability broadcasting
- All `session.addMessages()` calls were fire-and-forget - ignored Honcho errors and created race conditions with `session.getContext()`
- Empty session ID fallback - when `sessionId` was null, code called `honcho.session("")` creating random sessions instead of shared conversation

## Tool Execution Bugs

- Tool recursion wasn't awaited - second `decideAction` call ran outside try/catch, turning JSON parsing errors into unhandled rejections
- Object serialization bug - `tracker["psychology"]` and `tracker["search"]` objects were interpolated as `[object Object]` in prompts
- Psychology analysis targeted wrong peer - called `honcho.peer(this.agentName)` then passed `target` in options, analyzing own psychology instead of target participant

# Agent.ts Structured Output

- Inline JSON-schema builders (`getShouldRespondSchema`, `getActionDecisionSchema`, etc.) were added directly in `agent.ts`; should consolidate or share types so every agent extension isn't re-defining them.
- Added `safeParse`/`extractJSONObject`/`normalizeDecision` helpers in `agent.ts` to recover malformed structured responses; move this resilience into the LLM provider so downstream code can assume clean JSON.
