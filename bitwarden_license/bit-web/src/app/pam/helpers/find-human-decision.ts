import type { AccessApprover, AccessRequestDecisionView } from "../abstractions/access-lease";

/**
 * The human decision on a request — the deciding approver, or the holder ending their own lease
 * (also recorded as a human "deny" decision) — if any. v0/v1 records at most one; an automatic
 * (access-rule) decision is not a human decision and is skipped. Used wherever the UI needs to
 * name "who approved/denied/ended" versus showing the access-rule label.
 *
 * The SDK models the decider as `"automatic" | { human: AccessApprover }`, so a human decision is
 * simply one whose `decider` is not `"automatic"`.
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
