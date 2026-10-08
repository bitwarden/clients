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
 * Never caches the revealed cipher locally, so a lapsed lease leaves no decryptable secrets.
 * {@link fetchLeased} uses raw HTTP until a published `sdk-internal` has `leased_cipher()`.
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
   * The clock ticks outside the zone, but the re-lock rewrites plain component fields on the open
   * dialog, so emissions re-enter it. Applied after `distinctUntilChanged`, so only a change pays.
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
   * A still-restricted response means the lease lapsed after the state read, so it reports no
   * access and the dialog keeps its partial copy.
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
