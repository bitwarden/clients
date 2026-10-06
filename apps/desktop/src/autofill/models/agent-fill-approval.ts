import {
  AgentFillCipherType,
  AgentFillFailureReason,
} from "@bitwarden/common/autofill/agent-fill/agent-fill-ipc";

/** PROTOTYPE: agent autofill. Sent from the main process to the renderer to show the dialog. */
export type AgentFillApprovalRequest = {
  requestId: string;
  connectionName: string;
  domain: string;
  tabUrl: string;
  browser: string;
  cipherType: AgentFillCipherType;
};

export const AgentFillDenyReason = Object.freeze({
  WrongAccount: "wrong_account",
  NotRequested: "not_requested",
} as const);
export type AgentFillDenyReason = (typeof AgentFillDenyReason)[keyof typeof AgentFillDenyReason];

/**
 * PROTOTYPE: agent autofill. The renderer's answer. Carries only what the agent may see (item name,
 * username or card last four), never a secret.
 */
export type AgentFillApprovalResponse =
  | {
      decision: "approved";
      cipherId: string;
      itemName: string;
      username?: string;
      lastFour?: string;
    }
  | { decision: "denied"; reason?: AgentFillDenyReason }
  | { decision: "failed"; reason: AgentFillFailureReason; message: string };
