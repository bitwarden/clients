import { Observable } from "rxjs";

import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional seam that lets a privileged-access host (currently the web vault's PAM layer) reveal the
 * full cipher inside an already-open view once the caller gains access.
 *
 * A gated cipher opens as a server-restricted partial copy (name + URIs, no secrets) and the view
 * shows the access banner. When a host provides this token, the vault-item dialog subscribes to
 * {@link GatedCipherReloader.fullCipher$} for that cipher and swaps the partial cipher for the
 * emitted, fully-decryptable {@link Cipher} the moment access begins — e.g. right after the member
 * starts an approved request from the banner — and swaps back when it ends. Platforms without
 * privileged access leave the token unprovided, so the partial view stays put and nothing extra
 * runs.
 *
 * Exchanging a plain Observable rather than a component class keeps `libs/vault` free of any
 * dependency on the feature library that implements it. It exchanges the DOMAIN
 * {@link Cipher}, not a decrypted view, for two reasons: the dialog owns decryption (it already
 * holds the active user), and `formConfig.originalCipher` must be swapped too, or a subsequent save
 * would write the partial copy's blanks over the fields the server had suppressed.
 */
export interface GatedCipherReloader {
  /**
   * @returns a stream that emits `null` while the cipher stays gated, and the full, decryptable
   *   {@link Cipher} once the caller holds access covering it. The dialog only reveals on a non-null
   *   emission, so a transient `null` (no access yet) safely leaves the partial view in place; a
   *   `null` that FOLLOWS a reveal re-locks it.
   */
  fullCipher$(cipherId: string): Observable<Cipher | null>;
}

export const GATED_CIPHER_RELOADER = new SafeInjectionToken<GatedCipherReloader>(
  "GatedCipherReloader",
);
