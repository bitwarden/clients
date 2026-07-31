import { Observable } from "rxjs";

import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional seam that lets a privileged-access host (currently the web vault) reveal the
 * full cipher inside an already-open view once the caller gains access.
 *
 * A gated cipher opens with a partial-data local copy (name + URIs, no secrets). When a
 * host provides this token, the vault-item dialog subscribes to {@link fullCipher$} for
 * that cipher and swaps the partial copy for the emitted, fully-decryptable {@link Cipher}
 * the moment access is granted — no reopen needed. Platforms without privileged access
 * leave the token unprovided, so the partial view stays put and nothing extra runs.
 *
 * Exchanging a plain Observable rather than a component class keeps `libs/vault` free of
 * any dependency on the feature library that implements it.
 */
export interface GatedCipherReloader {
  /**
   * @returns a stream that emits `null` while the cipher stays gated, and the full,
   *   decryptable {@link Cipher} once the caller may open it. The dialog only swaps on a
   *   non-null emission, so a transient `null` safely leaves the partial view in place.
   */
  fullCipher$(cipherId: string): Observable<Cipher | null>;
}

export const GATED_CIPHER_RELOADER = new SafeInjectionToken<GatedCipherReloader>(
  "GatedCipherReloader",
);
