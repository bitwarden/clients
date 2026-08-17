import type { AccessDecisionVerdict } from "../abstractions/access-lease";

/**
 * Wire values of the server's `Bit.Services.Pam.Api.Models.AccessDecisionVerdict`, a byte enum the
 * decision endpoint binds as a NUMBER. Posting the SDK's string spelling instead makes
 * System.Text.Json fail to read the body, which surfaces as a bare 400 with no message — the
 * handler never runs, so nothing explains it. The SDK's own generated `AccessDecisionRequestModel`
 * documents the same contract (`0` = deny, `1` = approve), as does `toAccessDecisionVerdict`, which
 * reads it back.
 *
 * `"unknown"` is deliberately absent: it is a read-side spelling for a verdict this client does not
 * recognise, never something to submit.
 */
const WIRE_VERDICT: Partial<Record<AccessDecisionVerdict, 0 | 1>> = Object.freeze({
  deny: 0,
  approve: 1,
});

/**
 * The body of `POST /access-requests/{id}/decision`.
 *
 * Requests serialise camelCase (they go over the wire as-is); only responses read PascalCase. The
 * constructor takes the SDK's spelling so callers keep one vocabulary, and translates to the
 * server's numeric form here — at the seam that owns the wire contract.
 */
export class AccessDecisionRequest {
  readonly verdict: 0 | 1;
  readonly comment?: string;

  constructor(init: { verdict: AccessDecisionVerdict; comment?: string }) {
    const verdict = WIRE_VERDICT[init.verdict];
    if (verdict === undefined) {
      throw new Error(`Cannot record the verdict "${init.verdict}": expected "approve" or "deny".`);
    }
    this.verdict = verdict;
    this.comment = init.comment;
  }
}
