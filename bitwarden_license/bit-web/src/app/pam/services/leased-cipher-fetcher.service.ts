import { Injectable, inject } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";

/**
 * Fetches the full, encrypted cipher for a leased-access view.
 *
 * The sole producer of a revealed gated cipher: {@link PamCipherOpenGate} and
 * {@link PamGatedCipherReloader} both call {@link fetch} and hand the result to the
 * `CIPHER_OPEN_GATE`/`GATED_CIPHER_RELOADER` seams, so this is the one place that decides
 * whether an active lease currently covers a cipher.
 *
 * Re-reads the cipher straight from the server (`GET /ciphers/{id}`) rather than the local
 * cache — the cache stays partial-data until the seams swap it in for one view session, and
 * every reveal must reflect the server's current authorization, not a stale local copy. The
 * result is **transient**: it must never be written back into the local cipher cache.
 *
 * Known limitation: {@link Cipher.leaseGated}/{@link CipherView.leaseGated} no longer exists
 * on the domain model after the partial-cipher pivot (partial-data ciphers now decrypt
 * through the SDK, which has no concept of "served under a lease"). There is currently no
 * reachable point in `libs/vault`'s decrypt path (`DefaultCipherEncryptionService.decrypt`)
 * to re-stamp that marker onto the resulting `CipherView`, so `leaseGated` stays `false` for
 * a freshly revealed cipher. This only affects whether the cipher-view banner keeps polling
 * lease state *after* a reveal in the same dialog session (extend/end); the core
 * request-access -> activate -> reveal flow is unaffected, since it keys off `partial`.
 */
@Injectable({ providedIn: "root" })
export class LeasedCipherFetcherService {
  private readonly apiService = inject(ApiService);
  private readonly logService = inject(LogService);

  /**
   * @returns the full cipher when the caller currently holds an active lease (the server
   *   returns full, non-restricted data), or `null` when it is still gated (the server
   *   returns a restricted `partialData` envelope) or a 404 makes it unreachable (not
   *   visible to the caller, or deleted). Non-404 errors are logged and rethrown so the
   *   caller can distinguish "no lease yet" from a genuine failure.
   */
  async fetch(cipherId: string): Promise<Cipher | null> {
    try {
      const response = await this.apiService.getCipher(cipherId);
      const cipher = new Cipher(new CipherData(response));
      if (cipher.partialData != null) {
        // Still gated — no active lease covers it (yet), or access ended again.
        return null;
      }
      return cipher;
    } catch (e) {
      if (e instanceof ErrorResponse && e.statusCode === 404) {
        return null;
      }
      this.logService.error(`Failed to fetch leased cipher: ${e}`);
      throw e;
    }
  }
}
