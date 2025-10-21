export function sanitizeUsername(username: string): string {
  return username
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
}

export function createWorkspaceId(agentName: string): string {
  const fromEnv = process.env.HONCHO_WORKSPACE_ID;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return sanitizeUsername(agentName) || "default";
}

export function extractJSONObject(content: string): string | null {
  const trimmed = content.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return trimmed.slice(start, end + 1);
}

export function safeParse<T>(content: string, label: string): T | null {
  if (!content) {
    return null;
  }

  const candidate = extractJSONObject(content);
  if (!candidate) {
    console.error(`Failed to locate JSON object in ${label} response:`, content);
    return null;
  }

  try {
    return JSON.parse(candidate) as T;
  } catch (error) {
    console.error(`Failed to parse JSON for ${label}:`, candidate);
    return null;
  }
}

export type AgentDecisionType = "psychology" | "search" | "respond" | "unknown";

export function normalizeDecision(decision?: string): AgentDecisionType {
  if (!decision) {
    return "unknown";
  }

  const normalized = decision.trim().toLowerCase();
  if (!normalized) return "unknown";

  if (normalized === "psychology") return "psychology";
  if (normalized === "search") return "search";
  if (normalized === "respond" || normalized === "respond directly") return "respond";
  if (normalized.includes("psycholog") || normalized.includes("analyz")) return "psychology";
  if (normalized.includes("search")) return "search";
  if (normalized.includes("respond")) return "respond";

  return "unknown";
}
