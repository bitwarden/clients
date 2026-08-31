import { distinctUntilChanged, from, map, Observable, of, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { GatedCipherReloader } from "@bitwarden/vault";

import { liveActiveLease } from "..";

import { CipherAccessStateService } from "./cipher-access-state.service";

/**
 * PAM's {@link GatedCipherReloader}: reveals a gated cipher in place once an active lease
 * covers it, and re-locks it when the lease ends.
 *
 * Emits `null` while ungated, the full {@link Cipher} while covered, keyed off the lease id.
 * Reads through the STANDARD single-cipher endpoint, not a PAM-specific one, since the server
 * already decides per caller what a cipher's payload contains.
 *
 * "Ends" includes running out of time, which nothing announces: no mutation here, no push from
 * the server. {@link CipherAccessStateService} supplies the missing tick.
 *
 * THIS IS THE MODULE'S LAST RAW-HTTP CALL: swap {@link fetchLeased} onto
 * `pam().leases().leased_cipher(cipherId)` once a published `sdk-internal` carries it.
 *
 * The result is never written into the local cipher cache, so a lapsed lease can't leave
 * decryptable secrets behind.
 */
export class PamGatedCipherReloader implements GatedCipherReloader {
  constructor(
    private cipherAccessStateService: CipherAccessStateService,
    private apiService: ApiService,
    private logService: LogService,
  ) {}

  fullCipher$(cipherId: string): Observable<Cipher | null> {
    return this.cipherAccessStateService.state$(cipherId).pipe(
      map((state) => {
        // Read against the clock, not off the response: the stream re-emits the same state at the
        // lease's `notAfter`, and it is this call resolving to `undefined` on that second emission
        // that re-locks the open item.
        const leaseId = liveActiveLease(state, Date.now())?.id;
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
