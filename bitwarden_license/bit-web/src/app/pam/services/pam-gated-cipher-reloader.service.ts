import {
  catchError,
  distinctUntilChanged,
  from,
  map,
  merge,
  Observable,
  of,
  switchMap,
} from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { GatedCipherReloader } from "@bitwarden/vault";

import { AccessRefreshService, AccessRequestSdkService } from "..";

/**
 * PAM's {@link GatedCipherReloader}: reveals a gated cipher in place once the caller holds an active
 * lease over it, and re-locks it when the lease ends.
 *
 * Emits `null` while no lease covers the cipher and the full {@link Cipher} while one does, keyed off
 * the lease id — `distinctUntilChanged` means an unrelated access-state re-emit (a sibling request
 * resolving, say) does not trigger another fetch of the same lease's cipher.
 *
 * The full cipher is read through the STANDARD single-cipher endpoint
 * (`ApiService.getFullCipherDetails`, the same read sync uses), not through a PAM-specific one. That
 * is the point of the partial-cipher pivot: the server already decides per caller what a cipher's
 * payload contains — restricted without a lease, complete with one — so no dedicated leased-cipher
 * route is needed, and the poc's `GET /leases/ciphers/{id}/cipher` (deprecated and scheduled for
 * removal) has no successor here.
 *
 * The result is NEVER written into the local cipher cache. The cache stays partial for the lifetime
 * of the lease, so closing and reopening the item re-reads it and a lapsed lease cannot leave
 * decryptable secrets behind in local state.
 */
export class PamGatedCipherReloader implements GatedCipherReloader {
  constructor(
    private accessRequestSdkService: AccessRequestSdkService,
    private accessRefreshService: AccessRefreshService,
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
      map((state) => {
        const leaseId = state?.activeLease?.id;
        return leaseId == null ? null : uuidAsString(leaseId);
      }),
      distinctUntilChanged(),
      switchMap((leaseId) => (leaseId == null ? of(null) : from(this.fetchLeased(cipherId)))),
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
