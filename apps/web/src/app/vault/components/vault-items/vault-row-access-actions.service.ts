import { Observable } from "rxjs";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

/**
 * Row-menu actions for a PAM-gated ("partial") cipher in the vault list.
 *
 * The OSS-consumable seam: the implementation lives in commercial code. `vault-cipher-row`
 * injects it `{ optional: true }`, so an OSS build simply leaves it unprovided and the row menu
 * offers nothing extra. The row passes its cipher through untouched and renders one menu item
 * off the answer.
 */
export abstract class VaultRowAccessActionsService {
  /**
   * Whether the caller has an outstanding access request for the cipher that can still be
   * withdrawn — pending an approver, or approved but not yet started. Emits `false` for a
   * non-PAM-gated cipher.
   *
   * Safe to call from a template: memoized per cipher, and lazy — read on subscription, re-read
   * when the cipher's access changes.
   */
  abstract cancelableRequest$(cipher: CipherViewLike): Observable<boolean>;

  /**
   * Withdraw the cipher's outstanding access request. Outcome (success or failure) is surfaced by
   * the implementation itself; the returned promise resolves either way.
   */
  abstract cancelRequest(cipher: CipherViewLike): Promise<void>;
}
