import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional source of the full views of gated ciphers the user holds an active lease on.
 *
 * Each view is decrypted in memory, carries `leaseGated = true` and is never persisted. An id
 * leaves the map when its lease ends, and the map empties on lock, logout or account switch.
 */
export interface LeasedCipherSource {
  /** Leased full views for `userId`, keyed by cipher id. */
  leasedCipherViews$(userId: UserId): Observable<ReadonlyMap<string, CipherView>>;
}

export const LEASED_CIPHER_SOURCE = new SafeInjectionToken<LeasedCipherSource>(
  "LeasedCipherSource",
);
