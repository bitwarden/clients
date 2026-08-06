import { Injectable, inject } from "@angular/core";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  CipherOpenGate,
  CipherOpenVerdict,
  GatedCipherLike,
} from "@bitwarden/web-vault/app/vault/individual-vault/cipher-open-gate";

import { LeasedCipherFetcherService } from "./services/leased-cipher-fetcher.service";

/**
 * Decides what happens when a user opens a PAM-gated vault row (bound to `CIPHER_OPEN_GATE`).
 *
 * `partialData != null` on the locally cached cipher is the gating signal: the server sent
 * only name + URIs because no active lease currently covers it. When gated, this tries to
 * fetch the full cipher under an active lease first ({@link LeasedCipherFetcherService}) —
 * covering the case where a lease was granted since the last sync. With no active lease, it
 * still opens the **partial** copy: the cipher-lease banner (`CIPHER_VIEW_BANNER`) injected
 * into that view owns the request-access flow inline, and the gated-cipher reloader
 * (`GATED_CIPHER_RELOADER`) reveals the full cipher in place once a lease lands. The leased
 * `Cipher` handed back here is never persisted to local state — the cache stays partial.
 *
 * The `"handled"` verdict (e.g. an unlicensed org member should see a "Privileged Controls
 * license required" dialog instead of the partial view) is intentionally not produced here:
 * no license-status abstraction exists in the client yet to distinguish that case from
 * "PAM enabled, no lease". Once one lands, that check belongs here, before falling through to
 * the fetch-and-open-partial path below.
 */
@Injectable({ providedIn: "root" })
export class PamCipherOpenGate implements CipherOpenGate {
  private readonly configService = inject(ConfigService);
  private readonly leasedCipherFetcher = inject(LeasedCipherFetcherService);

  async check(cipher: GatedCipherLike, userId: string): Promise<CipherOpenVerdict> {
    if (cipher.partialData == null) {
      // Not gated, or the caller already holds an active lease (full data delivered on sync).
      return "open";
    }

    const flagOn = await this.configService.getFeatureFlag(FeatureFlag.Pam);
    if (!flagOn) {
      // A stale local partialData blob can outlive a server-side rollback; behave as ungated.
      return "open";
    }

    const fetched = await this.leasedCipherFetcher.fetch(cipher.id);
    if (fetched != null) {
      return { kind: "openWith", cipher: fetched };
    }

    // No active lease: open the partial copy. The banner drives the request flow inline and
    // the reloader reveals the full cipher in place once a lease lands.
    return "open";
  }
}
