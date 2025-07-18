import { CollectionView } from "@bitwarden/admin-console/common";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

export interface VaultItem<C extends CipherViewLike> {
  collection?: CollectionView;
  cipher?: C;
}
