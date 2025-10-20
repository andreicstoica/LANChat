# 🧠 Honcho + LANChat: Memory-Powered D&D Game Demo

## Background: What Honcho Is

[**Honcho**](https://honcho.dev) is Plastic Labs’ **memory and social cognition layer** for multi-agent systems.  
It gives agents a persistent understanding of _who they’re talking to_ — across sessions, peers, and contexts.

Each workspace contains:

- **Peers** – humans or agents with evolving profiles (beliefs, preferences, relationships).
- **Sessions** – contexts where peers interact (e.g., a chatroom or game scene).
- **Messages** – the dialogue that Honcho ingests to build and update representations.

Honcho continuously analyzes these interactions to generate two kinds of representations:

- **Global** — long-term identity and traits (e.g., “Alice prefers direct communication”).
- **Working** — situational context between peers (e.g., “NPC X currently trusts Player Y”).

Agents can query these representations using the SDK or API to retrieve summaries, insights, or context tailored to a specific peer or session.

---

## Concept: A D&D-Style Multiplayer Game

This demo reimagines **LANChat** as a **live, narrative game world** where Honcho powers memory, relationships, and adaptation.  
Players and AI agents co-inhabit a shared chatroom (the “tabletop”), with Honcho acting as the _cognitive layer_ that makes interactions persistent and personal.

### Core Roles

- **Player Peers:** Human participants controlling characters (their actions and dialogue).
- **Game Master (GM) Agent:** The storyteller that uses Honcho’s context and player profiles to shape the narrative.
- **NPC Agents:** Supporting characters that build opinions and memories about each player over time.

---

## Game Structure

### 1. Initialization

Each new game session corresponds to a **Honcho Session**.  
All participants (player, GM, NPCs) are registered as **Peers** within it.  
This allows Honcho to track their dialogue and relationships automatically.

### 2. Message Ingestion

Every in-game message — from players or agents — is added to the session.  
Honcho parses this conversation and continuously updates what it “knows” about each peer:

- The player’s tone, preferences, moral alignment, and playstyle.
- The NPC’s attitudes or trust levels toward the player.

### 3. Adaptive Behavior

Before responding, agents (GM or NPC) can query Honcho for insights like:

> “What does this NPC know or feel about the player right now?”  
> “What tone or pacing does this player seem to prefer?”

Those insights guide how agents respond — making their behavior feel grounded in past interactions rather than one-off LLM prompts.

### 4. Persistent Memory & Summaries

After each scene, the session is summarized: key events, decisions, and relationships.  
Honcho stores this narrative memory, enabling continuity across sessions (e.g., “Last week you betrayed the merchant”).  
Players can view their evolving **character profiles** — generated directly from Honcho’s peer representations.

### 5. Interaction Patterns

- `/profile` — pulls a short summary of who the player is “known as.”
- `/recap` — returns a high-level summary of what happened so far.
- `/search <topic>` — finds past references or quests using Honcho’s hybrid search.

---

## Why This Matters

Using Honcho for a D&D-style game shows _why_ memory and social reasoning matter in agent systems:

- Demonstrates **long-term adaptation** and _relationship awareness_.
- Highlights how **multiple agents** can maintain consistent personalities and histories.
- Transforms a generic chatroom (LANChat) into a **persistent world with evolving characters** — all powered by Honcho’s underlying representations.
