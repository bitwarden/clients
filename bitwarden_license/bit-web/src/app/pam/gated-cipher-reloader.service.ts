import { Injectable, inject } from "@angular/core";
import { distinctUntilChanged, from, Observable, of, switchMap, timer } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import type { AccessLeaseId } from "@bitwarden/sdk-internal";
import { GatedCipherReloader } from "@bitwarden/vault";

import { AccessRequestSdkService } from "./abstractions/access-request-sdk.service";
import { LeasedCipherFetcherService } from "./services/leased-cipher-fetcher.service";

/** How often to re-check the cipher's access state while its dialog stays open. */
const POLL_INTERVAL_MS = 5_000;

/**
 * Reveals the full cipher in an already-open view once a lease covers it (bound to
 * `GATED_CIPHER_RELOADER`).
 *
 * The SDK-backed leasing services here are pull-based (no live push, unlike a
 * notifications-driven design), so this polls the cipher's access-state snapshot
 * ({@link AccessRequestSdkService.getCipherAccessState}) on an interval while it stays
 * subscribed: while the snapshot carries no active lease the stream stays `null` and the
 * partial view holds. When an active lease appears — e.g. the member just activated an
 * approved request from the cipher-lease banner — it fetches the full, decryptable cipher
 * once via {@link LeasedCipherFetcherService} and emits it so the dialog can swap the
 * partial cipher in place. `distinctUntilChanged` on the lease id means a same-lease re-poll
 * never re-fetches. The leased `Cipher` is transient and is never written to the local
 * cache — every reveal re-fetches.
 */
@Injectable({ providedIn: "root" })
export class PamGatedCipherReloader implements GatedCipherReloader {
  private readonly configService = inject(ConfigService);
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly leasedCipherFetcher = inject(LeasedCipherFetcherService);

  fullCipher$(cipherId: string): Observable<Cipher | null> {
    return this.configService.getFeatureFlag$(FeatureFlag.Pam).pipe(
      switchMap((enabled) => (enabled ? this.pollActiveLeaseId(cipherId) : of(null))),
      distinctUntilChanged(),
      switchMap((leaseId) =>
        leaseId == null ? of(null) : from(this.leasedCipherFetcher.fetch(cipherId)),
      ),
    );
  }

  /** Emits the caller's active lease id for `cipherId` (or `null`) immediately, then every {@link POLL_INTERVAL_MS}. */
  private pollActiveLeaseId(cipherId: string): Observable<AccessLeaseId | null> {
    return timer(0, POLL_INTERVAL_MS).pipe(
      switchMap(() => from(this.fetchActiveLeaseId(cipherId))),
    );
  }

  private async fetchActiveLeaseId(cipherId: string): Promise<AccessLeaseId | null> {
    try {
      const state = await this.accessRequestSdkService.getCipherAccessState(cipherId);
      return state.activeLease?.id ?? null;
    } catch {
      // Swallow — a transient failure shouldn't tear down the poll; the next tick retries.
      return null;
    }
  }
}
