import type { AccessApprover, AccessRequestDecisionView } from "../abstractions/access-lease";

/** Fixed so a test that asserts on a decision's timestamp does not depend on when it runs. */
const DECIDED_AT = "2026-06-10T10:30:00.000Z";

/**
 * A human decision, for tests that exercise decider resolution (`resolveResolver`,
 * `findHumanDecision`).
 *
 * The SDK models the decider as a tagged union, so a human decision is
 * `{ human: AccessApprover }` rather than a flat set of id/name/email fields. Building it here keeps
 * every spec from re-deriving that shape — and from getting it subtly wrong, since the union's other
 * arm is the bare string `"automatic"`.
 *
 * `name`/`email` default to absent rather than to placeholder text, because the display chain under
 * test is `name || email || id` and a builder that always filled all three would never exercise its
 * fallbacks.
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
        // The SDK brands its own `UserId`, distinct from the one in `common/types/guid`; widening
        // through the field's own type keeps the builder from depending on either brand.
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
 * The decision the server records when a lease holder ends their own lease: a `deny` whose decider is
 * the requester themself. That is how the client tells "ended by you" from "revoked by an operator",
 * since the SDK's lease status collapses both to `revoked`.
 */
export function selfEndDecision(requesterId: string, comment?: string): AccessRequestDecisionView {
  return humanDecision({ id: requesterId, verdict: "deny", comment });
}
