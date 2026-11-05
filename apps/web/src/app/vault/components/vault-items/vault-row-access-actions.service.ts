import { Observable } from "rxjs";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

/**
 * Row-menu actions for a PAM-gated ("partial") cipher in the vault list. Implemented in
 * commercial code; OSS builds leave it unprovided and the row menu offers nothing extra.
 */
export abstract class VaultRowAccessActionsService {
  /**
   * Whether the caller has an access request for the cipher that can still be withdrawn: pending,
   * or approved but not yet started. Memoized per cipher, so safe to call from a template.
   */
  abstract cancelableRequest$(cipher: CipherViewLike): Observable<boolean>;

  /**
   * Withdraws the cipher's outstanding access request. The implementation reports the outcome
   * itself, and the promise resolves either way.
   */
  abstract cancelRequest(cipher: CipherViewLike): Promise<void>;
}
