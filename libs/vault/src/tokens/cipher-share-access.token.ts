import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Sharing for a vault item, as the row overflow menu needs it. The implementation lives with the
 * sharing feature; see {@link CIPHER_SHARE_ACCESS} for why it is reached through a token.
 */
export interface CipherShareAccess {
  /**
   * Whether the item can be shared. Synchronous, because the menu evaluates it per row on every
   * change detection. Returns `false` until the check for the item has resolved, so the action
   * stays hidden on first render rather than flashing in and out.
   */
  canShare(cipher: CipherViewLike): boolean;

  /** Opens the client's share flow for the item. */
  share(cipher: CipherViewLike): Promise<void>;
}

/**
 * Lets the row menu offer sharing without importing `@bitwarden/tools-share`, which already depends
 * on `@bitwarden/vault`. A client that provides no implementation shows no share action.
 */
export const CIPHER_SHARE_ACCESS = new SafeInjectionToken<CipherShareAccess>("CIPHER_SHARE_ACCESS");
