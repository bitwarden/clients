import { Observable } from "rxjs";

import { UserId } from "../../types/guid";
import { CipherDecryptionFailureMap } from "../models/cipher-decryption-failure";

/**
 * Surfaces per-field cipher decryption failures discovered via the SDK's
 * graceful decrypt path, without disturbing the main vault load.
 *
 * Implementations run a secondary diagnostic pass over the user's encrypted
 * ciphers (gated by `FeatureFlag.PMXXXXX_GracefulCipherDecryption`) and emit a
 * map of `CipherId` → failed-field list for every cipher with at least one
 * field that could not be decrypted. Ciphers with no failures are absent from
 * the map.
 *
 * When the feature flag is off, implementations emit an empty map and skip the
 * extra decrypt pass entirely.
 */
export abstract class CipherDecryptionFailureService {
  /**
   * Stream of per-field failures for the given user.
   *
   * Lazy and debounced: subscribers pay for the decrypt pass only while
   * subscribed; the underlying work stops when the last subscriber unsubscribes.
   * Re-emits when {@link CipherService.ciphers$} changes.
   */
  abstract decryptionFailuresByCipher$(userId: UserId): Observable<CipherDecryptionFailureMap>;
}
