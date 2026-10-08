import { Observable } from "rxjs";

import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Lets a privileged-access host swap the full cipher into an open vault-item dialog while access
 * lasts. Exchanges the domain {@link Cipher}, since the dialog owns decryption and must swap
 * `formConfig.originalCipher` too.
 */
export interface GatedCipherReloader {
  /**
   * @returns a stream emitting `null` while the cipher stays gated and the full, decryptable
   *   {@link Cipher} once access covers it. A `null` after a reveal re-locks the dialog.
   */
  fullCipher$(cipherId: string): Observable<Cipher | null>;
}

export const GATED_CIPHER_RELOADER = new SafeInjectionToken<GatedCipherReloader>(
  "GatedCipherReloader",
);
