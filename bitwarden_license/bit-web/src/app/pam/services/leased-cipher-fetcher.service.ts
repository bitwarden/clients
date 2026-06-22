import { PamApiService } from "@bitwarden/bit-pam";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";

/**
 * Fetches the full encrypted cipher for a leased-access view.
 *
 * Wraps `PamApiService.getLeasedCipher` and converts the server's response
 * into a {@link Cipher} domain object. The result is **transient** — callers
 * should hand it to the renderer for one view session and let it go out of
 * scope. It must not be written into the local cipher cache: the cache stays
 * partial-data, and every view re-fetches.
 */
export class LeasedCipherFetcherService {
  constructor(private readonly pamApiService: PamApiService) {}

  /**
   * @returns the leased cipher when the caller holds an active lease, or
   *   `null` when the server reports 404 (no active lease, cipher not visible,
   *   or feature flag off — all collapse to "request a lease" from the
   *   caller's perspective). Non-404 errors are rethrown so the caller can
   *   distinguish "no lease yet" from genuine failures.
   */
  async fetch(cipherId: string): Promise<Cipher | null> {
    try {
      const response = await this.pamApiService.getLeasedCipher(cipherId);
      const cipher = new Cipher(new CipherData(response));
      // Transient client marker: this cipher is served under an active lease, so it
      // arrives with full data and no `partialData`. The cipher-lease banner gates
      // its lease-state fetch on this once `partialData` is gone. See Cipher.leaseGated.
      cipher.leaseGated = true;
      return cipher;
    } catch (e) {
      if (e instanceof ErrorResponse && e.statusCode === 404) {
        return null;
      }
      throw e;
    }
  }
}
