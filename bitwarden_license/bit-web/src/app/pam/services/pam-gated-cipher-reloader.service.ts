import { NgZone } from "@angular/core";
import {
  catchError,
  defer,
  distinctUntilChanged,
  from,
  map,
  merge,
  MonoTypeOperatorFunction,
  Observable,
  of,
  switchMap,
  tap,
} from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { GatedCipherReloader } from "@bitwarden/vault";

import { AccessRefreshService, AccessRequestSdkService, liveActiveLease, rereadOnLapse } from "..";
import type { CipherAccessStateView } from "../abstractions/access-lease";
import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";

/**
 * PAM's {@link GatedCipherReloader}: reveals a gated cipher in place once an active lease
 * covers it, and re-locks it when the lease ends.
 *
 * Emits `null` while ungated, the full {@link Cipher} while covered, keyed off the lease id.
 * Reads through the STANDARD single-cipher endpoint, not a PAM-specific one, since the server
 * already decides per caller what a cipher's payload contains.
 *
 * "Ends" includes running out of time, which nothing announces; {@link rereadOnLapse} supplies
 * that tick (PM-41837).
 *
 * THIS IS THE MODULE'S LAST RAW-HTTP CALL: swap {@link fetchLeased} onto
 * `pam().leases().leased_cipher(cipherId)` once a published `sdk-internal` carries it.
 *
 * The result is never written into the local cipher cache, so a lapsed lease can't leave
 * decryptable secrets behind.
 */
export class PamGatedCipherReloader implements GatedCipherReloader {
  constructor(
    private accessRequestSdkService: AccessRequestSdkService,
    private accessRefreshService: AccessRefreshService,
    private ticker: AccessBadgeTickerService,
    private ngZone: NgZone,
    private apiService: ApiService,
    private logService: LogService,
  ) {}

  fullCipher$(cipherId: string): Observable<Cipher | null> {
    return defer(() => {
      let held: CipherAccessStateView | null = null;
      const read$ = () =>
        from(this.accessRequestSdkService.getCipherAccessState(cipherId)).pipe(
          catchError((error: unknown) => {
            // A failed read keeps the last answer, so it can hold a reveal but never grant one.
            this.logService.error(error);
            return of(held);
          }),
          tap((state) => (held = state)),
        );

      return merge(of(undefined), this.accessRefreshService.accessChanged$(cipherId)).pipe(
        switchMap(() => rereadOnLapse(read$, this.ticker.ticks$)),
        map((state) => {
          const leaseId = liveActiveLease(state, Date.now())?.id;
          return leaseId == null ? null : uuidAsString(leaseId);
        }),
        distinctUntilChanged(),
        this.inAngularZone(),
        switchMap((leaseId) => (leaseId == null ? of(null) : from(this.fetchLeased(cipherId)))),
      );
    });
  }

  /**
   * The clock ticks OUTSIDE the zone, since an in-zone interval never lets NgZone settle. The
   * re-lock it drives rewrites plain component fields on the open dialog, so change detection has
   * to run behind it. Applied after `distinctUntilChanged`, so only a real change pays for it.
   */
  private inAngularZone<T>(): MonoTypeOperatorFunction<T> {
    return (source) =>
      new Observable<T>((subscriber) =>
        source.subscribe({
          next: (value) => this.ngZone.run(() => subscriber.next(value)),
          error: (error: unknown) => subscriber.error(error),
          complete: () => subscriber.complete(),
        }),
      );
  }

  /**
   * Read the cipher now that a lease covers it. A response that is still restricted means the lease
   * lapsed between the state read and this fetch, so it is reported as "no access" rather than
   * revealed — the partial copy the dialog already holds is the correct thing to keep showing.
   */
  private async fetchLeased(cipherId: string): Promise<Cipher | null> {
    try {
      const response = await this.apiService.getFullCipherDetails(cipherId);
      const cipher = new Cipher(new CipherData(response));
      return cipher.partialData == null ? cipher : null;
    } catch (error: unknown) {
      this.logService.error(error);
      return null;
    }
  }
}
