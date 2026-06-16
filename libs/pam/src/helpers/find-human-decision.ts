import { AccessDeciderKind } from "../abstractions/access-decider-kind";
import { Decision } from "../abstractions/responses/access-request-details.response";

/**
 * The human decision on a request — the deciding approver — if any. v0 records at most one; an
 * automatic (access-rule) decision is not a human decision and is skipped. Used wherever the UI
 * needs to name "who approved/denied" versus showing the access-rule label.
 */
export function findHumanDecision(decisions: Decision[]): Decision | undefined {
  return decisions.find((d) => d.deciderKind === AccessDeciderKind.Human);
}
