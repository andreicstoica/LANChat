// Shared types for the LAN chat application

// Message types
export enum MessageType {
  CHAT = "chat",
  AGENT_DATA = "agent_data",
  SYSTEM = "system",
  JOIN = "join",
  LEAVE = "leave",
  AGENT_RESPONSE = "agent_response",
}

// Core message interface
export interface Message {
  id: string;
  type:
  | MessageType
  | "chat"
  | "agent_response"
  | "system"
  | "join"
  | "leave"
  | "agent_data";
  username: string;
  content: string;
  metadata: {
    timestamp: string;
    [key: string]: any;
  };
}

// User and agent types
export interface User {
  id: string;
  username: string;
  type: "human";
  socket?: any;
  observe_me?: boolean;
  peerId: string;
}

export interface Agent {
  id: string;
  username: string;
  type: "agent";
  capabilities: string[];
  socket: any;
  peerId: string;
}

// Network interface type
export interface NetworkInterface {
  interface: string;
  address: string;
  primary: boolean;
}

// API response types
export interface UsersResponse {
  users: Array<{ id: string; username: string; type: string; observe_me: boolean }>;
  agents: Array<{
    id: string;
    username: string;
    type: string;
    capabilities: string[];
  }>;
  error?: string;
}

export interface HistoryResponse {
  history: Message[];
  total: number;
  error?: string;
}

export interface HonchoMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

// Agent-specific types
export interface ResponseDecision {
  should_respond: boolean;
  reason: string;
  confidence: number;
}

export interface AgentDecision {
  decision: string;
  reason: string;
  confidence: number;
}

export interface PsychologyAnalysis {
  participant: string;
  response: string;
}

export interface Dialectic {
  target: string;
  question: string;
}

export interface Search {
  query: string;
}

// Game-specific types
export interface Quest {
  id: string;
  title: string;
  description: string;
  status: "active" | "completed" | "failed";
  objectives: string[];
}

export interface NPCState {
  name: string;
  mood: string;
  location: string;
  trustLevel: number; // -100 to 100
  lastInteraction: string;
}

export interface GameState {
  currentScene: string;
  activeQuests: Quest[];
  npcStates: Map<string, NPCState>;
  turnOrder?: string[]; // optional turn-based mode
  gameMode: boolean;
}
