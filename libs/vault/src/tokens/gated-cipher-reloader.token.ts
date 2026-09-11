import { Observable } from "rxjs";

import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional seam letting a privileged-access host reveal the full cipher inside an already-open
 * view once the caller gains access.
 *
 * A gated cipher opens as a partial copy; when a host provides this token, the vault-item
 * dialog subscribes to {@link GatedCipherReloader.fullCipher$} and swaps in the full
 * {@link Cipher} the moment access begins, swapping back when it ends.
 *
 * Exchanges a plain Observable, not a component class, to keep `libs/vault` decoupled from the
 * implementing library. Exchanges the DOMAIN {@link Cipher}, since the dialog owns decryption
 * and `formConfig.originalCipher` must swap too, or a save would blank suppressed fields.
 */
export interface GatedCipherReloader {
  /**
   * @returns a stream that emits `null` while the cipher stays gated, and the full, decryptable
   *   {@link Cipher} once access covers it. The dialog only reveals on a non-null emission; a
   *   `null` that FOLLOWS a reveal re-locks it.
   */
  fullCipher$(cipherId: string): Observable<Cipher | null>;
}

export const GATED_CIPHER_RELOADER = new SafeInjectionToken<GatedCipherReloader>(
  "GatedCipherReloader",
);
