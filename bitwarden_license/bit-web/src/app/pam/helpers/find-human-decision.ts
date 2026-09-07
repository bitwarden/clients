import type { AccessApprover, AccessRequestDecisionView } from "../abstractions/access-lease";

/**
 * The human decision on a request — the deciding approver, or the holder ending their own lease
 * (also recorded as a human "deny") — if any. An automatic decision is skipped.
 *
 * The SDK models the decider as `"automatic" | { human: AccessApprover }`, so a human decision
 * is simply one whose `decider` isn't `"automatic"`.
 */
export function findHumanDecision(
  decisions: AccessRequestDecisionView[],
): AccessRequestDecisionView | undefined {
  return decisions.find((d) => d.decider !== "automatic");
}

/**
 * The approver identity recorded on a decision, or `undefined` for an automatic (access-rule)
 * decision — which carries no approver. Unwraps the SDK's `decider: "automatic" | { human }`.
 */
export function humanApprover(decision: AccessRequestDecisionView): AccessApprover | undefined {
  return decision.decider === "automatic" ? undefined : decision.decider.human;
}
