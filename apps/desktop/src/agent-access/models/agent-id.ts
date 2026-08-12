/**
 * Identifiers for the AI coding agent clients Agent Access can detect and register the bundled
 * `aac` MCP server with. Renderer-safe (no Node imports) so both the main process (detection,
 * registration) and the renderer (agent list UI) can share the same ids without either importing
 * across the main/renderer boundary — see `apps/desktop/CLAUDE.md`.
 */
export const AgentId = Object.freeze({
  Claude: "claude",
  Codex: "codex",
  Cursor: "cursor",
  Gemini: "gemini",
  Copilot: "copilot",
} as const);
export type AgentId = (typeof AgentId)[keyof typeof AgentId];

const AGENT_ID_VALUES: readonly string[] = Object.values(AgentId);

export function isAgentId(value: unknown): value is AgentId {
  return typeof value === "string" && AGENT_ID_VALUES.includes(value);
}

export function toAgentId(value: unknown): AgentId | undefined {
  return isAgentId(value) ? value : undefined;
}
