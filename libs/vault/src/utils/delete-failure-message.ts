import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

/**
 * The i18n key explaining a failed delete. The server refuses a mutation on a restricted cipher
 * with a bare 404, so only the client can name the reason. Shared by every delete surface so they
 * agree.
 */
export function deleteFailureMessageKey(cipher: CipherViewLike): string {
  return CipherViewLikeUtils.isRestricted(cipher)
    ? "restrictedItemChangeRefused"
    : "deleteItemError";
}
