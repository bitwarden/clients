import { BitSvg } from "@bitwarden/assets/svg";

import { AgentId } from "../models/agent-id";

import { ClaudeIcon } from "./claude.icon";
import { CodexIcon } from "./codex.icon";
import { CopilotIcon } from "./copilot.icon";
import { CursorIcon } from "./cursor.icon";
import { GeminiIcon } from "./gemini.icon";

export * from "./claude.icon";
export * from "./codex.icon";
export * from "./copilot.icon";
export * from "./cursor.icon";
export * from "./gemini.icon";

/**
 * Brand logos for the AI coding agents Agent Access can detect, keyed by `AgentId` so a
 * template can resolve the right logo for an agent without a switch statement.
 */
export const AGENT_LOGOS: Record<AgentId, BitSvg> = {
  [AgentId.Claude]: ClaudeIcon,
  [AgentId.Codex]: CodexIcon,
  [AgentId.Cursor]: CursorIcon,
  [AgentId.Gemini]: GeminiIcon,
  [AgentId.Copilot]: CopilotIcon,
};
