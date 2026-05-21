import { Injectable } from "@angular/core";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  CollectionMembershipForLeasing,
  deriveGatedState,
  GatedState,
  LeaseRequestResponse,
  LeaseResponse,
  PamApiService,
} from "@bitwarden/pam";

/**
 * Outcome of attempting to open a (possibly) gated cipher. Drives the cipher
 * view's branching:
 *
 *   - "passthrough" → not gated, or feature flag off; caller proceeds with the
 *     existing local-decrypt path. No round-trip was issued.
 *   - "reveal"      → server returned 200 (lease active / auto-approved);
 *     caller may render the locally-decrypted cipher with secret fields
 *     visible, plus the "leased pill" placeholder (PM-37266 will replace it).
 *   - "pending"     → server returned 202; caller should hand `request` off to
 *     the approval modal (PM-37265).
 *   - "denied"      → server returned 403; caller renders the denial state
 *     using `reason` verbatim, no retry.
 */
export type CipherOpenDecision =
  | { kind: "passthrough" }
  | { kind: "reveal"; leaseId: string | null }
  | { kind: "pending"; request: LeaseRequestResponse }
  | { kind: "denied"; reason: string };

/**
 * Inputs needed to derive the gated state for one cipher. The caller assembles
 * these from whatever sources are available in its scope.
 */
export type CipherOpenContext = {
  cipherId: string;
  memberships: readonly CollectionMembershipForLeasing[];
  activeLeases: readonly LeaseResponse[];
  userId: string;
  now?: Date;
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
    if (!flagOn) {
      return { kind: "passthrough" };
    }

    const state: GatedState = deriveGatedState(
      context.cipherId,
      context.memberships,
      context.activeLeases,
      context.userId,
      context.now ?? new Date(),
    );

    if (state === "unleased") {
      return { kind: "passthrough" };
    }

    // gated_no_lease or gated_active_lease → server is the source of truth.
    // Always round-trip so the audit log entry fires server-side.
    const result = await this.pamApiService.fetchGatedCipher(context.cipherId);
    switch (result.kind) {
      case "approved":
        return { kind: "reveal", leaseId: result.leaseId };
      case "pending":
        return { kind: "pending", request: result.request };
      case "denied":
        return { kind: "denied", reason: result.reason };
    }
  }
}
