import { Injectable } from "@angular/core";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { AccessRequestResponse, PamApiService } from "@bitwarden/pam";

/**
 * Outcome of attempting to open a (possibly) gated cipher. Drives the cipher
 * view's branching:
 *
 *   - "passthrough" → not gated, or feature flag off; caller proceeds with the
 *     existing local-decrypt path. No round-trip was issued.
 *   - "reveal"      → server returned 200; the caller already holds an active
 *     lease. Caller may render the locally-decrypted cipher with secret
 *     fields visible, plus the "leased pill" placeholder (PM-37266 will
 *     replace it).
 *   - "pending"     → server returned 202 with a fresh pending request. Caller
 *     must always surface the Request Access modal (PM-37265) so the user
 *     explicitly confirms the request before any approval — automated or
 *     human — happens.
 *   - "awaiting_redemption" → the caller already holds an approved-but-unredeemed
 *     ticket for this cipher. Opening offers to start the lease rather than
 *     creating a duplicate request (CipherOpenAwaitingRedemption).
 *   - "denied"      → server returned 403; caller renders the denial state
 *     using `reason` verbatim, no retry.
 */
export type CipherOpenDecision =
  | { kind: "passthrough" }
  | { kind: "reveal"; leaseId: string | null }
  | { kind: "pending"; request: AccessRequestResponse }
  | { kind: "awaiting_redemption"; request: AccessRequestResponse }
  | { kind: "denied"; reason: string };

/**
 * Inputs needed to open one cipher. `gated` is the only signal the caller must
 * source locally — "does an enabled access rule attach to this cipher?" — and it
 * exists purely so non-gated ciphers (the common case) short-circuit without an
 * HTTP call. Whether the caller already holds a lease is NOT pre-computed here:
 * `fetchGatedCipher` is the source of truth and decides reveal/pending/denied.
 */
export type CipherOpenContext = {
  cipherId: string;
  gated: boolean;
  userId: string;
};

/**
 * Mediates the cipher-open round-trip for PAM (PM-37264). Behind
 * {@link FeatureFlag.Pam}, intercepts opens of gated ciphers, calls
 * `GET /ciphers/{id}` once, and surfaces a routing decision. Non-gated ciphers
 * and flag-off sessions short-circuit to "passthrough" without an HTTP call.
 *
 * Audit-log side-effects (the server-side reason this round-trip exists in v0)
 * are emitted by the server; this service does not log or persist anything
 * locally.
 */
@Injectable({ providedIn: "root" })
export class CipherOpenInterceptorService {
  constructor(
    private readonly pamApiService: PamApiService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Drives the open flow for one cipher. See {@link CipherOpenDecision} for
   * the branches the caller must handle.
   */
  async open(context: CipherOpenContext): Promise<CipherOpenDecision> {
    const flagOn = await this.configService.getFeatureFlag(FeatureFlag.Pam);
    if (!flagOn || !context.gated) {
      // Flag off, or no access rule applies → open via the normal local-decrypt
      // path. No round-trip.
      return { kind: "passthrough" };
    }

    // Gated → the server is the source of truth. Always round-trip so the audit
    // log entry fires server-side, whether or not we already hold a lease.
    const result = await this.pamApiService.fetchGatedCipher(context.cipherId);
    switch (result.kind) {
      case "approved":
        return { kind: "reveal", leaseId: result.leaseId };
      case "pending":
        return { kind: "pending", request: result.request };
      case "awaiting_redemption":
        return { kind: "awaiting_redemption", request: result.request };
      case "denied":
        return { kind: "denied", reason: result.reason };
    }
  }
}
