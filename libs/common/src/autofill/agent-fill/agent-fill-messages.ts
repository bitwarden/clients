/**
 * Agent-fill message contract — the desktop↔extension leg of Agent Access browser fill
 * (`delivery: "fill"` in the agent-access local wire protocol).
 *
 * Carried as untyped JSON payloads over the SDK IPC channel under {@link AGENT_FILL_IPC_TOPIC}.
 * The desktop renderer is the requester; the extension background is the responder, except for
 * {@link AgentFillHelloMessage}, which the extension sends unsolicited so the desktop learns a
 * live endpoint exists (SDK IPC gives the desktop no way to enumerate connected extensions).
 *
 * Security contract (see apps/desktop/src/agent-access/agent-access-architecture.md §M5):
 * - {@link AgentFillRequestMessage} is the ONLY message that ever carries a credential value,
 *   and it flows desktop → extension only. Every response type is value-free by construction —
 *   per-field outcomes name targets and reasons, never values.
 * - The requesting agent never names a destination: no tab id, origin, or selector appears in
 *   any request. `origin` fields in requests echo what the extension itself reported, so the
 *   extension can refuse on drift (string equality, TOCTOU).
 * - `totpCode` is the current one-time code, never the TOTP seed.
 */

export const AGENT_FILL_IPC_TOPIC = "agent-fill";

export type AgentFillFieldRole = "username" | "password" | "totp";

/** Machine-readable reasons a role (or a whole page) has no safe fill target. */
export type AgentFillRefusalReason =
  | "no-login-form"
  | "no-password-field"
  | "hidden-field-only"
  | "cross-origin-frame"
  | "looks-like-registration"
  | "ambiguous-target";

export type AgentFillFormClass =
  "login" | "registration" | "multi-step-username" | "multi-step-password" | "none" | "ambiguous";

/** A §4.1-safe candidate the extension's planner selected for one role. */
export type AgentFillCandidate = {
  role: AgentFillFieldRole;
  /** Human-readable target descriptor, e.g. `input[type=password]#pw (login form)`. Never a value. */
  target: string;
  visible: boolean;
  /** "top" for the top frame, otherwise the frame's own origin (always same-origin with the tab). */
  frame: string;
};

/** Read-only description of the active tab's login surface. Approval-free, vault-free. */
export type AgentFillTargetDescription = {
  origin: string;
  formClass: AgentFillFormClass;
  candidates: AgentFillCandidate[];
  refusals: { role: AgentFillFieldRole; reason: AgentFillRefusalReason }[];
  /**
   * Single-use token naming the plan above: the extension holds `{tabId, origin, per-role opids
   * + element signatures}` in memory against it, ~30s expiry. Echoing it back in a fill request
   * pins the fill to exactly this plan.
   */
  targetToken: string;
  expiresInMs: number;
};

export type AgentFillPerFieldOutcome = {
  role: AgentFillFieldRole;
  status: "filled" | "skipped" | "failed";
  /** Present when filled: the target descriptor. Never a value. */
  target?: string;
  /** Present when skipped/failed: a machine-readable reason. Never a value. */
  reason?: string;
};

export type AgentFillResult = {
  status: "filled" | "partial" | "no-safe-target" | "target-changed" | "origin-changed";
  /** The origin actually observed at fill time. */
  origin: string;
  fields: AgentFillPerFieldOutcome[];
  /** Populated when status is a refusal. */
  reason?: AgentFillRefusalReason;
};

/** Extension → desktop, unsolicited: announces a live agent-fill endpoint. */
export type AgentFillHelloMessage = {
  type: "agentFillHello";
};

/** Desktop → extension: describe the active tab. */
export type AgentFillDescribeRequestMessage = {
  type: "agentFillDescribeRequest";
  requestId: string;
};

export type AgentFillDescribeResponseMessage = {
  type: "agentFillDescribeResponse";
  requestId: string;
  /** Absent when the page has no describable login surface; `refusal` says why. */
  target?: AgentFillTargetDescription;
  refusal?: AgentFillRefusalReason;
};

/**
 * Desktop → extension: perform one immediate fill. The only value-bearing message in the
 * contract. The extension holds `credential` in memory for the duration of the fill only —
 * no vault write, no cache, no last-used update, no logging.
 */
export type AgentFillRequestMessage = {
  type: "agentFillRequest";
  requestId: string;
  /** The origin the desktop matched against — extension refuses on drift (string equality). */
  origin: string;
  /** Pins the fill to a previously described plan; absent = plan internally at fill time. */
  targetToken?: string;
  fields: AgentFillFieldRole[];
  credential: {
    username?: string;
    password?: string;
    /** Current TOTP code, never the seed. */
    totpCode?: string;
  };
};

export type AgentFillResponseMessage = {
  type: "agentFillResponse";
  requestId: string;
  result: AgentFillResult;
};

export type AgentFillIpcMessage =
  | AgentFillHelloMessage
  | AgentFillDescribeRequestMessage
  | AgentFillDescribeResponseMessage
  | AgentFillRequestMessage
  | AgentFillResponseMessage;

export function isAgentFillIpcMessage(value: unknown): value is AgentFillIpcMessage {
  if (typeof value !== "object" || value == null) {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return (
    type === "agentFillHello" ||
    type === "agentFillDescribeRequest" ||
    type === "agentFillDescribeResponse" ||
    type === "agentFillRequest" ||
    type === "agentFillResponse"
  );
}
