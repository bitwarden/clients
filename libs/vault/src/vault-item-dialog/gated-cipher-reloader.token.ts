import { Observable } from "rxjs";

import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional seam that lets a privileged-access host (currently the web vault's
 * PAM layer) reveal the full cipher inside an already-open view once the caller
 * gains access.
 *
 * A gated cipher opens with a partial-data local copy (name + URIs, no secrets)
 * and the view shows the lease banner. When a host provides this token, the
 * vault-item dialog subscribes to {@link GatedCipherReloader.fullCipher$} for
 * that cipher and swaps the partial cipher for the emitted, fully-decryptable
 * {@link Cipher} the moment a lease becomes active — e.g. right after the member
 * starts an approved request from the banner. Platforms without privileged
 * access leave the token unprovided, so the partial view stays put and nothing
 * extra runs. Exchanging a plain Observable (not a component class) keeps
 * `libs/vault` free of any dependency on the feature library that implements it.
 */
export interface GatedCipherReloader {
  /**
   * @returns a stream that emits `null` while the cipher stays gated, and the
   *   full, decryptable {@link Cipher} once the caller holds an active lease
   *   covering it. The dialog only swaps on a non-null emission, so a transient
   *   `null` (no lease yet) safely leaves the partial view in place.
   */
  fullCipher$(cipherId: string): Observable<Cipher | null>;
}

export const GATED_CIPHER_RELOADER = new SafeInjectionToken<GatedCipherReloader>(
  "GatedCipherReloader",
);
