import type { AccessDecisionVerdict } from "../abstractions/access-lease";

/**
 * The body of `POST /access-requests/{id}/decision`.
 *
 * Requests serialise camelCase (they go over the wire as-is); only responses read PascalCase. The
 * verdict travels as the SDK's string spelling — `"approve"` / `"deny"` — matching
 * {@link AccessDecisionVerdict} so the client has one vocabulary rather than a numeric one for
 * writes and a string one for reads.
 */
export class AccessDecisionRequest {
  readonly verdict: AccessDecisionVerdict;
  readonly comment?: string;

  constructor(init: { verdict: AccessDecisionVerdict; comment?: string }) {
    this.verdict = init.verdict;
    this.comment = init.comment;
  }
}
