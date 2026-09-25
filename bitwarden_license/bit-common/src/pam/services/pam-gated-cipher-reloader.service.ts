import { NgZone } from "@angular/core";
import {
  catchError,
  concat,
  distinctUntilChanged,
  filter,
  from,
  map,
  merge,
  MonoTypeOperatorFunction,
  Observable,
  of,
  switchMap,
  take,
} from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import type { GatedCipherReloader } from "@bitwarden/vault";

import { AccessRefreshService, AccessRequestSdkService, liveActiveLease } from "..";
import type { CipherAccessStateView } from "../abstractions/access-lease";
import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { fetchLeasedCipher } from "../helpers/leased-cipher";

/**
 * PAM's {@link GatedCipherReloader}: reveals a gated cipher in place once an active lease
 * covers it, and re-locks it when the lease ends.
 *
 * Emits `null` while ungated, the full {@link Cipher} while covered, keyed off the lease id.
 * Reads through the STANDARD single-cipher endpoint, not a PAM-specific one, since the server
 * already decides per caller what a cipher's payload contains.
 *
 * "Ends" includes running out of time, which nothing announces; {@link whileLeaseRuns$} supplies
 * that tick (PM-41837).
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
    return merge(of(undefined), this.accessRefreshService.accessChanged$(cipherId)).pipe(
      switchMap(() =>
        from(this.accessRequestSdkService.getCipherAccessState(cipherId)).pipe(
          catchError((error: unknown) => {
            // An unreadable access state must leave the item gated, not reveal it.
            this.logService.error(error);
            return of(null);
          }),
        ),
      ),
      switchMap((state) => this.whileLeaseRuns$(state)),
      map((state) => {
        // Clock read: this resolving to `undefined` on a later tick is what re-locks the item.
        const leaseId = liveActiveLease(state, Date.now())?.id;
        return leaseId == null ? null : uuidAsString(leaseId);
      }),
      distinctUntilChanged(),
      this.inAngularZone(),
      switchMap((leaseId) => (leaseId == null ? of(null) : from(this.fetchLeased(cipherId)))),
    );
  }

  /**
   * `state`, re-emitted once its lease's window closes. `take(1)` because a lease lapses once, and
   * the shared badge clock rather than a timer here, so the surfaces on one item cannot disagree
   * about when it ended.
   */
  private whileLeaseRuns$(
    state: CipherAccessStateView | null,
  ): Observable<CipherAccessStateView | null> {
    if (liveActiveLease(state, Date.now()) == null) {
      return of(state);
    }
    return concat(
      of(state),
      this.ticker.ticks$.pipe(
        filter((nowMs) => liveActiveLease(state, nowMs) == null),
        take(1),
        map(() => state),
      ),
    );
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
      return await fetchLeasedCipher(this.apiService, cipherId);
    } catch (error: unknown) {
      this.logService.error(error);
      return null;
    }
  }
}
