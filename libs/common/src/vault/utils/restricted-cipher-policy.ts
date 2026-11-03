import { Cipher } from "../models/domain/cipher";
import { CipherView } from "../models/view/cipher.view";
import { CipherLike } from "../types/cipher-like";

import { CipherViewLikeUtils } from "./cipher-view-like-utils";

export const RestrictedCipherAction = Object.freeze({
  /** Folder, favorite, archive and unarchive. Single item only. Always allowed. */
  UserFields: "user-fields",
  Edit: "edit",
  Attachments: "attachments",
  Delete: "delete",
  Restore: "restore",
  Clone: "clone",
  /** The share link (Send of an item). */
  Share: "share",
  AssignCollections: "assign-collections",
  /** Selection for bulk actions. Bulk writes exclude restricted ciphers, folder included. */
  BulkSelect: "bulk-select",
} as const);
export type RestrictedCipherAction =
  (typeof RestrictedCipherAction)[keyof typeof RestrictedCipherAction];

/** What a revealed cipher allows. Delete and restore stay blocked while a reveal is live. */
const REVEALED_ALLOWED_ACTIONS: ReadonlySet<RestrictedCipherAction> = new Set([
  RestrictedCipherAction.UserFields,
  RestrictedCipherAction.Edit,
  RestrictedCipherAction.Attachments,
]);

/**
 * The single rule for what a user may do with a restricted cipher: it is read-only, except for
 * the user fields (folder, favorite, archive). While its full view is revealed, edit and
 * attachments are allowed too.
 *
 * Server asks:
 * - Send `edit: false`, `permissions.delete/restore: false`, and new `permissions.clone/share`
 *   flags on restricted and leased ciphers. The checks then read permissions, and this policy
 *   stays only as a fallback for servers that do not send the new flags.
 * - The write gate (`CipherLeaseGate`) allows the partial-update endpoint (folder, favorite) and
 *   the archive endpoints for restricted ciphers.
 */
export class RestrictedCipherPolicy {
  /** True for a restricted cipher. Accepts the domain `Cipher` and any view. */
  static isRestricted(cipher: CipherLike): boolean {
    return cipher instanceof Cipher ? cipher.isPartial : CipherViewLikeUtils.isRestricted(cipher);
  }

  /**
   * False when the restricted-data rule blocks the action.
   * True does not grant the action: callers still apply their normal permission checks.
   *
   * @param revealedView The live view that `RevealedCipherService` holds for this cipher, if any.
   * It applies to that view itself and to the stored copy while it is restricted. A cipher that is
   * no longer restricted gets the normal rule, even while its old reveal is still held.
   */
  static allows(
    cipher: CipherLike,
    action: RestrictedCipherAction,
    revealedView?: CipherView,
  ): boolean {
    if (
      revealedView != null &&
      (cipher === revealedView || RestrictedCipherPolicy.isRestricted(cipher))
    ) {
      return REVEALED_ALLOWED_ACTIONS.has(action);
    }
    if (!RestrictedCipherPolicy.isRestricted(cipher)) {
      return true;
    }
    return action === RestrictedCipherAction.UserFields;
  }
}
