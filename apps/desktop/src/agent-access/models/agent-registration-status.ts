/**
 * Read-only registration status for a single AI coding agent client (agent-access-architecture.md,
 * "M3 — multi-agent support"). Distinct from `RegisterWithAgentStatus` in `agent-registration.ts`,
 * which describes the *outcome of a write*; this describes what a read-only query currently
 * observes in the agent's own config, so the UI can show a persistent "Connected" state per agent
 * across app restarts without ever writing anything. Renderer-safe (no Node imports) — see
 * `apps/desktop/CLAUDE.md`. Populated by `AgentAccessRegistrationStatusService` in
 * `../main/agent-access-registration-status.service.ts`.
 */
import { AgentId } from "./agent-id";

export const AgentRegistrationStatus = Object.freeze({
  /** The agent's own config was read and parsed/scanned successfully and contains a Bitwarden MCP
   *  server entry. */
  Registered: "registered",
  /** The agent's own config was read and parsed/scanned successfully and contains no Bitwarden
   *  entry. */
  NotRegistered: "notRegistered",
  /** The config file is missing or unreadable, or its contents couldn't be confidently
   *  parsed/scanned. A real and important state in its own right, not a fallback to hide errors —
   *  the UI must be able to show "we don't know" rather than a false-negative "not connected". */
  Unknown: "unknown",
} as const);
export type AgentRegistrationStatus =
  (typeof AgentRegistrationStatus)[keyof typeof AgentRegistrationStatus];

export interface AgentRegistrationStatusResult {
  agentId: AgentId;
  status: AgentRegistrationStatus;
}
