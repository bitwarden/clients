import { LeasingPolicy } from "../abstractions/leasing-policy";

/**
 * How a cipher's leasing policy is resolved when a lease is requested:
 * - "human"     — at least one rule requires a human approver decision.
 * - "automated" — every rule can be evaluated by the server alone
 *                 (IP allowlist, time-of-day window, etc.).
 *
 * Drives the vault-row pill: callers can warn the user up-front whether
 * opening this cipher will queue for a reviewer or be decided immediately.
 */
export type PolicyEvaluation = "human" | "automated";

/**
 * Walks the policy tree; returns "human" if any `human_approval` node is
 * present, otherwise "automated". An empty `all_of` is treated as automated
 * (no human gate).
 */
export function classifyPolicyEvaluation(policy: LeasingPolicy): PolicyEvaluation {
  switch (policy.kind) {
    case "human_approval":
      return "human";
    case "ip_allowlist":
    case "time_of_day":
      return "automated";
    case "all_of":
      return policy.children.some((c) => classifyPolicyEvaluation(c) === "human")
        ? "human"
        : "automated";
  }
}
