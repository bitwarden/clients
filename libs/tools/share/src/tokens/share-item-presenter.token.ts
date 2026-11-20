import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Puts the client's sharing surface on screen for an item. Each client presents sharing
 * differently — the web vault opens a drawer, the desktop app a dialog, the browser extension
 * navigates to a page — so the surface, and whatever it needs of the item, are client-supplied.
 *
 * Takes the item as the list gave it: a surface that needs a decrypted {@link CipherView} resolves
 * one itself, and a surface that only needs the id does not pay for a lookup it cannot use.
 *
 * Resolve once the surface is on screen, not once the user is done with it.
 */
export interface ShareItemPresenter {
  present(cipher: CipherViewLike): Promise<void>;
}

export const SHARE_ITEM_PRESENTER = new SafeInjectionToken<ShareItemPresenter>(
  "SHARE_ITEM_PRESENTER",
);
