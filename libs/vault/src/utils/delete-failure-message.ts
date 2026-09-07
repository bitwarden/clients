import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

/**
 * The i18n key explaining a failed delete. The server refuses a mutation on a leasing-gated cipher
 * with a bare 404, so the client is the only side able to name that reason (PM-42916). Shared by the
 * four delete surfaces so they cannot drift apart on which reason a user is told.
 */
export function deleteFailureMessageKey(
  cipher: CipherViewLike,
  collections: CollectionView[] = [],
): string {
  return isGatedForCaller(cipher, collections) ? "pamDeleteRequiresAccess" : "deleteItemError";
}

/**
 * The client-side mirror of the server's union rule: gated only when every collection the cipher is
 * reachable through is governed by an enabled rule. Partial data settles it on its own; the
 * collections matter for the cipher the client still holds in full because its lease lapsed after
 * the last sync, which is the only shape that reaches a delete.
 *
 * An id absent from {@link collections} is not evidence of gating, so the union reads as unsatisfied
 * — a generic message on a gated item beats sending someone to request access they do not need.
 */
function isGatedForCaller(cipher: CipherViewLike, collections: CollectionView[]): boolean {
  if (CipherViewLikeUtils.isPartial(cipher)) {
    return true;
  }

  const paths = cipher.collectionIds ?? [];
  if (paths.length === 0) {
    return false;
  }

  const gating = new Set(
    collections.filter((c) => c.hasEnabledAccessRule).map((c) => String(c.id)),
  );
  return paths.every((id) => gating.has(String(id)));
}
