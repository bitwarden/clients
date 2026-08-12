import { AgentFillFieldRole } from "@bitwarden/common/autofill/agent-fill";

/**
 * Internal browser-extension types for the agent-fill content command. The value-bearing op only
 * ever travels background → content script within the extension; results are value-free by
 * construction (opid + status + static reason, never a value).
 */

/** The content-script command dispatched per frame to execute an agent fill. */
export const AGENT_FILL_FORM_COMMAND = "agentFillForm";

/** One field write the background asks a frame's content script to perform. */
export type AgentFillOp = {
  opid: string;
  role: AgentFillFieldRole;
  /** The credential value for this role. Held in memory for the duration of the fill only. */
  value: string;
};

/**
 * Per-op outcome returned by the content script. Reasons are static machine-readable strings —
 * never a value, never an exception message.
 */
export type AgentFillOpResult = {
  opid: string;
  status: "filled" | "failed";
  reason?: string;
};
