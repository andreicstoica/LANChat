# 🎲 Developer-Themed Game Mode

LANChat now supports a memory-powered developer-themed game mode using Honcho!

## Quick Start

Start the server in game mode:

```bash
bun run start --game
```

This automatically spawns:

- **Honcho the GM** - The master storyteller
- **Stack** - Friendly Senior Developer (helpful mentor, loves sharing knowledge)
- **Lint** - Suspicious Code Reviewer (guarded, needs to be won over)
- **Merge** - Hostile Tech Lead (antagonistic, forms negative opinions)

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
- **Automatically detects when you're ready to progress to the next level**

## Game Levels

### Level 1: "The Dev Environment"

**Setting**: A cozy developer workspace where the team discusses Honcho implementation

**Learning Objectives**:

- Learn about Honcho's working representations from Stack
- Demonstrate understanding to Lint (gain their trust)
- Understand basic Honcho concepts

**Progression**: When you've learned about working representations AND gained Lint's trust, the GM will automatically announce progression to Level 2.

### Level 2: "Production Deploy"

**Setting**: The production environment - time to put your knowledge into practice

**Learning Objectives**:

- Apply Honcho concepts in a production setting
- Handle advanced scenarios with the team
- Master Honcho's full capabilities

**Progression**: This is the final level - focus on mastering all Honcho features.

## Playing the Game

1. Connect using the LANChat-UI frontend:

   - The frontend will show your current level
   - Display your learning progress and NPC relationships

2. The GM will introduce the scene automatically

3. Interact naturally with NPCs - they'll remember your interactions!

4. NPCs will:
   - **Stack**: Become more helpful as you gain trust, shares advanced knowledge
   - **Lint**: Gradually open up with patient, respectful interactions, becomes gatekeeper for progression
   - **Merge**: Respect displays of technical competence, despise hand-waving

## Automatic Progression

The game features **automatic progression** - no manual commands needed:

- The GM continuously monitors your learning progress
- When you meet the requirements for the next level, the GM announces it
- The scene automatically transitions to the new level
- All NPCs maintain their relationships across levels

## Example Interaction

```
Player: Hello Stack, I'm new to Honcho
Stack: Welcome, developer! I'm Stack, the senior developer here. I'd be happy to explain Honcho's working representations - they're the key to understanding how agents remember context.

Player: Thank you, that's very helpful
Stack: You're most welcome! I can see you're eager to learn. Let me tell you about how working representations help agents build relationships...

[Later in the session]
Player: Lint, do you think I understand working representations well enough?
Lint: Hmm, you've been asking good questions. Show me you can explain the concept back to me...

[After demonstrating understanding]
Honcho the GM: 🎉 **LEVEL UP!** You've mastered The Dev Environment! Moving to Production Deploy...
```

## API Endpoints

- `GET /api/game/state` - Current level, progress, and NPC relationships

## Learning Honcho Through Play

This game mode teaches real Honcho concepts:

- **Working Representations**: How agents remember and understand each other
- **Memory Management**: How Honcho stores and retrieves context
- **Session Management**: How conversations are tracked
- **Psychology Analysis**: How agents understand player behavior

The NPCs build relationships over time, making each playthrough unique based on how you interact with them!
