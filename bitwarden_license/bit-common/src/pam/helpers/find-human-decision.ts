import type { AccessApprover, AccessRequestDecisionView } from "../abstractions/access-lease";

/**
 * The human decision on a request, if any. A holder ending their own lease also records one, as a
 * deny.
 */
export function findHumanDecision(
  decisions: AccessRequestDecisionView[],
): AccessRequestDecisionView | undefined {
  return decisions.find((d) => d.decider !== "automatic");
}

export function humanApprover(decision: AccessRequestDecisionView): AccessApprover | undefined {
  return decision.decider === "automatic" ? undefined : decision.decider.human;
}
