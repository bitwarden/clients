import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

/**
 * The i18n key explaining a failed delete. The server refuses a mutation on a gated cipher with a
 * bare 404, so only the client can name the reason. Shared by every delete surface so they agree.
 */
export function deleteFailureMessageKey(
  cipher: CipherViewLike,
  collections: CollectionView[] = [],
): string {
  return isGatedForCaller(cipher, collections) ? "pamDeleteRequiresAccess" : "deleteItemError";
}

/**
 * A full copy whose lease lapsed since sync is gated if every collection holding it has an enabled
 * rule (the server's union rule). Unknown collections count as ungated; a generic error beats a
 * needless access request.
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
