# 🎲 D&D Game Mode

LANChat now supports a memory-powered D&D-style game mode using Honcho!

## Quick Start

Start the server in game mode:

```bash
bun run start --game
```

This automatically spawns:

- **Honcho the GM** - The master storyteller
- **Elderwyn** - Friendly NPC (helpful merchant/guide)
- **Thorne** - Suspicious NPC (guarded, needs to be won over)
- **Grimjaw** - Hostile NPC (antagonistic, forms negative opinions)

## How It Works

### Memory-Powered NPCs

Each NPC uses Honcho's working representations to:

- Remember their specific relationship with each player
- Adjust their behavior based on past interactions
- Build trust or hostility over time
- Query player psychology before responding

### Game Master Intelligence

Honcho the GM:

- Queries player profiles to tailor narration
- Decides when to inject story beats
- Tracks game state and quest progress
- Creates personalized narrative experiences

### API Endpoints

- `GET /api/game/state` - Current scene, NPCs, quests
- `GET /api/game/npcs` - NPC states and relationships
- `POST /api/game/scene` - Change current scene
- `GET /api/game/recap` - Session summary

## Playing the Game

1. Connect as a human player using the terminal client:

   ```bash
   bun run client
   ```

2. The GM will introduce the scene automatically

3. Interact naturally with NPCs - they'll remember your interactions!

4. NPCs will:
   - **Elderwyn**: Become more helpful as you gain trust
   - **Thorne**: Gradually open up with patient, respectful interactions
   - **Grimjaw**: Respect displays of strength, despise weakness

## Example Interaction

```
Player: Hello Elderwyn, I'm new here
Elderwyn: Welcome, traveler! I'm Elderwyn, the local guide. How can I help you today?

Player: Thank you, that's very kind
Elderwyn: You're most welcome! I can see you're a respectful sort. Let me tell you about the old ruins to the north...

[Later in the session]
Player: Elderwyn, do you know anything about the mysterious stranger?
Elderwyn: Ah, my friend! Since you've been so kind, I'll share what I know. The stranger you speak of...
```

The NPCs build relationships over time, making each playthrough unique based on how you interact with them!
