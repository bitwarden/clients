import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

export interface VaultItem<C extends CipherViewLike> {
  collection?: CollectionView;
  cipher?: C;
}

export function compareVaultItems<C extends CipherViewLike>(
  a: VaultItem<C>,
  b: VaultItem<C>,
): boolean {
  if (a.cipher && b.cipher) {
    return a.cipher.id === b.cipher.id;
  }
  if (a.collection && b.collection) {
    return a.collection.id === b.collection.id;
  }
  return false;
}
