import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

export interface VaultItem<C extends CipherViewLike> {
  collection?: CollectionView;
  cipher?: C;
}
