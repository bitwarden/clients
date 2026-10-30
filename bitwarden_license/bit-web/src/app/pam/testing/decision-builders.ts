import type { AccessApprover, AccessRequestDecisionView } from "../abstractions/access-lease";

/** Fixed so a test asserting on a decision's timestamp doesn't depend on when it runs. */
const DECIDED_AT = "2026-06-10T10:30:00.000Z";

/**
 * `name` and `email` default to absent rather than placeholders, so specs exercise the
 * `name || email || id` display fallbacks.
 */
export function humanDecision(init: {
  id: string;
  name?: string;
  email?: string;
  verdict?: AccessRequestDecisionView["verdict"];
  comment?: string;
  decidedAt?: string;
}): AccessRequestDecisionView {
  return {
    decider: {
      human: {
        // Widened through the field's own type, since the SDK's `UserId` brand differs from
        // `common/types/guid`.
        id: init.id as unknown as AccessApprover["id"],
        name: init.name,
        email: init.email,
      },
    },
    verdict: init.verdict ?? "approve",
    comment: init.comment,
    decidedAt: init.decidedAt ?? DECIDED_AT,
  };
}

/** A rule's decision; the bare `"automatic"` decider credits the rule rather than a person. */
export function automaticDecision(
  init: {
    verdict?: AccessRequestDecisionView["verdict"];
    comment?: string;
    decidedAt?: string;
  } = {},
): AccessRequestDecisionView {
  return {
    decider: "automatic",
    verdict: init.verdict ?? "approve",
    comment: init.comment,
    decidedAt: init.decidedAt ?? DECIDED_AT,
  };
}

/**
 * The decision the server records when a holder ends their own lease: a `deny` decided by the
 * requester.
 */
export function selfEndDecision(requesterId: string, comment?: string): AccessRequestDecisionView {
  return humanDecision({ id: requesterId, verdict: "deny", comment });
}
