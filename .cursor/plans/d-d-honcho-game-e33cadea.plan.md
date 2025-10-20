<!-- e33cadea-ac07-4517-8f5f-07fb13b7a66c e2fce12a-bd9e-4fca-80ce-3486877c5eb0 -->
# D&D Memory-Powered Game Implementation

## Core Approach

Transform LANChat into a D&D-style game where:

- **Honcho the GM** narrates and manages the game state
- **NPC agents** (friendly, suspicious, hostile) have Honcho-powered memories of each player
- Minimal session controls in a future frontend
- Commands stay natural in chat

## Implementation Steps

### 1. Game Master Agent (`src/game-agents/gm-agent.ts`)

Extend `ChatAgent` to create "Honcho the GM":

- System prompt: narrative storyteller who tracks game state
- Uses `peer.chat()` to query player profiles before narrating
- Decides when to inject narration based on:
  - Key moments (combat, discoveries, NPC encounters)
  - Player questions/actions
  - Turn-based triggers
- Maintains game state in memory (current scene, active quest, player locations)

Key methods:

- `shouldNarrate()` — decides if GM should respond (more selective than base agent)
- `queryPlayerContext()` — calls Honcho dialectic to understand player style/preferences
- `generateNarration()` — creates story beats using player context

### 2. NPC Agents with Working Representations

Create 3 NPC types in `src/game-agents/`:

- **`friendly-npc-agent.ts`** — helpful merchant/guide
- **`suspicious-npc-agent.ts`** — guarded, needs to be won over
- **`hostile-npc-agent.ts`** — antagonistic, forms negative opinions

Each NPC:

- Uses `peer.chat(question, {sessionId, targetPeerId})` to query working rep: "What do I know about this player?" 
- Adjusts tone/trust based on Honcho's response
- Tracks relationship state (trust level, recent interactions)
- Pre-defined personality but relationship-aware responses

Enable local representations:

- Configure peers with `observe_others: true` when registering NPCs
- NPCs build local reps of players as they interact

### 3. Game State Management

Add to `src/types.ts`:

```typescript
interface GameState {
  currentScene: string;
  activeQuests: Quest[];
  npcStates: Map<string, NPCState>;
  turnOrder?: string[]; // optional turn-based mode
}

interface NPCState {
  name: string;
  mood: string;
  location: string;
}
```

Store in server memory, sync via socket events

### 4. Game Command API Endpoints

Add command endpoints that frontend can call via socket events or REST

### 5. Minimal Frontend Session Controls

Add API endpoints in `src/server/api.ts`:

- `GET /api/game/state` — current scene, NPCs, quests
- `POST /api/game/scene` — GM triggers new scene
- `GET /api/game/npcs` — list NPC states and relationships
- `GET /api/game/recap` — fetch session summary

Create simple HTML UI later (not in this plan) with:

- Session info display
- NPC relationship meters
- Scene title/description

### 6. Server Configuration for Game Mode

Add game mode flag to `src/server/index.ts`:

- `--game` flag enables D&D mode
- Auto-spawns GM + 3 NPCs on startup
- Configures Honcho with local representations enabled

### 7. Testing & Iteration

Run full scenario:

1. Start server in game mode
2. Connect human player
3. GM introduces scene
4. Player interacts with NPCs
5. Verify NPCs query working reps before responding
6. Check that relationships evolve over time

### To-dos

- [ ] Create Honcho the GM agent with narrative logic and player context queries
- [ ] Build 3 NPC agents (friendly, suspicious, hostile) with working representation queries
- [ ] Add game state types and NPC state tracking to types.ts
- [ ] Implement /profile, /recap, /scene, /npcs commands in terminal client
- [ ] Add game-specific API endpoints for state, NPCs, and recap
- [ ] Add --game flag to server that auto-spawns GM and NPCs with local reps enabled