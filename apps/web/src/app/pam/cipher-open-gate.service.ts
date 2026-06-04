import { Injectable } from "@angular/core";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LeasedCipherFetcher, RequestAccessTrigger } from "@bitwarden/pam";

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
 * fetch the full cipher under any active lease first; if the server says
 * "no lease" (404) we surface the request-access modal. After the modal
 * closes with a fresh automatic lease we re-fetch — the freshly-leased Cipher
 * is handed back via the `openWith` verdict so the dialog renders full data
 * without ever persisting it to local state.
 */
@Injectable({ providedIn: "root" })
export class PamCipherOpenGate implements CipherOpenGate {
  constructor(
    private readonly configService: ConfigService,
    private readonly leasedCipherFetcher: LeasedCipherFetcher,
    private readonly requestAccessTrigger: RequestAccessTrigger,
  ) {}

  async check(cipher: GatedCipherLike, _userId: string): Promise<CipherOpenVerdict> {
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

    // No active lease yet — drive the request-access flow.
    const outcome = await this.requestAccessTrigger.requestAccess(cipher.id);
    if (outcome === "lease-created") {
      const afterLease = await this.leasedCipherFetcher.fetch(cipher.id);
      if (afterLease != null) {
        return { kind: "openWith", cipher: afterLease };
      }
    }
    // request-created (awaiting human approval) or dismissed → don't open the view.
    return "handled";
  }
}
