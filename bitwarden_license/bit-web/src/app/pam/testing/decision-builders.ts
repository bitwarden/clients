import type { AccessApprover, AccessRequestDecisionView } from "../abstractions/access-lease";

/** Fixed so a test asserting on a decision's timestamp doesn't depend on when it runs. */
const DECIDED_AT = "2026-06-10T10:30:00.000Z";

/**
 * A human decision, for tests that exercise decider resolution (`resolveResolver`,
 * `findHumanDecision`).
 *
 * The SDK models the decider as a tagged union — `{ human: AccessApprover }`, not flat
 * id/name/email fields — so building it here keeps specs from re-deriving that shape.
 *
 * `name`/`email` default to absent, not placeholder text, since the display chain under test is
 * `name || email || id` and always filling all three would never exercise the fallbacks.
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

/**
 * An access-rule decision — the automatic path, where no approver is involved. Its `decider` is the
 * bare `"automatic"`, which is what tells the UI to credit the rule rather than a person.
 */
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
 * The decision the server records when a lease holder ends their own lease: a `deny` whose
 * decider is the requester. Tells "ended by holder" from "revoked by an operator", since the
 * SDK's lease status collapses both to `revoked`.
 */
export function selfEndDecision(requesterId: string, comment?: string): AccessRequestDecisionView {
  return humanDecision({ id: requesterId, verdict: "deny", comment });
}
