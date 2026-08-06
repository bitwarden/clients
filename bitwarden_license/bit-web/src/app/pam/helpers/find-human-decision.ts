import type { AccessApprover, AccessRequestDecisionView } from "../abstractions/access-lease";

/**
 * The human decision on a request — the deciding approver, or the holder ending their own lease
 * (also recorded as a human "deny" decision) — if any. v0/v1 records at most one; an automatic
 * (access-rule) decision is not a human decision and is skipped. Used wherever the UI needs to
 * name "who approved/denied/ended" versus showing the access-rule label.
 */
export function findHumanDecision(
  decisions: AccessRequestDecisionView[],
): AccessRequestDecisionView | undefined {
  return decisions.find((d) => d.decider !== "automatic");
}

/**
 * The approver identity carried by a human decision, or `undefined` for an automatic
 * (access-rule) decision. The SDK models the decider as `"automatic" | { human: AccessApprover }`.
 */
export function humanApprover(decision: AccessRequestDecisionView): AccessApprover | undefined {
  return decision.decider === "automatic" ? undefined : decision.decider.human;
}
