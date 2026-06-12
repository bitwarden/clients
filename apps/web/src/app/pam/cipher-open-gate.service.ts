import { Injectable, inject } from "@angular/core";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LeasedCipherFetcher } from "@bitwarden/pam";

import {
  CipherOpenGate,
  CipherOpenVerdict,
  GatedCipherLike,
} from "../vault/individual-vault/cipher-open-gate";

/**
 * Decides what happens when a user clicks a PAM-gated cipher row.
 *
 * `partialData != null` is the gating signal: the server delivered only name +
 * URIs because the caller doesn't currently hold a covering lease. We try to
 * fetch the full cipher under any active lease first. With no active lease we
 * open the **partial** view anyway — the cipher-lease banner injected into the
 * view owns every request interaction inline (approved → "Start access",
 * pending → "Cancel request", neither → "Request access" with a fold-out form),
 * so the user can see partial cipher data while requesting. After an automatic
 * lease lands, the gated-cipher reloader reveals the full cipher in place; the
 * leased Cipher is never persisted to local state.
 */
@Injectable({ providedIn: "root" })
export class PamCipherOpenGate implements CipherOpenGate {
  private readonly configService = inject(ConfigService);
  private readonly leasedCipherFetcher = inject(LeasedCipherFetcher);

  async check(cipher: GatedCipherLike, userId: string): Promise<CipherOpenVerdict> {
    if (cipher.partialData == null) {
      // Not gated, or caller already holds an active lease (full data delivered).
      return "open";
    }
    const flagOn = await this.configService.getFeatureFlag(FeatureFlag.Pam);
    if (!flagOn) {
      return "open";
    }

    const fetched = await this.leasedCipherFetcher.fetch(cipher.id);
    if (fetched != null) {
      return { kind: "openWith", cipher: fetched };
    }

    // No active lease: open the partial view. The banner drives the request flow
    // inline and the reloader reveals the full cipher in place once a lease lands.
    return "open";
  }
}
