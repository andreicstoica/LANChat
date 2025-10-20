# Tech Debt I've Come Across

# README.md / General Setup

- no clear instruction to start local Honcho containerized server before running the demo (following instructions just gets you a connection error)
- different env.example vs env.template -> template is the proper one to follow because it mentions a honcho base url
- found some API key errors trying to hit the Honcho server upon start (missing in server's `index.ts` file and commented out in the `agent.ts` file)
- no clear explanation of AI/LLM server setup in README.md -> currently configured for local Ollama model but not documented

# Agent Integration Bugs (FIXED)

## Critical Registration Issues

- **FIXED**: Agents registered as `type: "user"` instead of `type: "agent"` - server never added them to agents map, breaking `/api/users`, `agent_data` events, and capability broadcasting
- **FIXED**: All `session.addMessages()` calls were fire-and-forget - swallowed Honcho errors and created race conditions with `session.getContext()`
- **FIXED**: Empty session ID fallback - when `sessionId` was null, code called `honcho.session("")` creating random sessions instead of shared conversation

## Tool Execution Bugs

- **FIXED**: Tool recursion wasn't awaited - second `decideAction` call ran outside try/catch, turning JSON parsing errors into unhandled rejections
- **FIXED**: Object serialization bug - `tracker["psychology"]` and `tracker["search"]` objects were interpolated as `[object Object]` in prompts
- **FIXED**: Psychology analysis targeted wrong peer - called `honcho.peer(this.agentName)` then passed `target` in options, analyzing own psychology instead of target participant

# agent.ts Structured Output Follow-Ups

- Inline JSON-schema builders (`getShouldRespondSchema`, `getActionDecisionSchema`, etc.) were added directly in `agent.ts`; should consolidate or share types so every agent extension isn't re-defining them.
- Added `safeParse`/`extractJSONObject`/`normalizeDecision` helpers in `agent.ts` to recover malformed structured responses; move this resilience into the LLM provider so downstream code can assume clean JSON.
