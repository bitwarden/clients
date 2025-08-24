import { CollectionView } from "@bitwarden/admin-console/common";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

export interface VaultItem<C extends CipherViewLike> {
  collection?: CollectionView;
  cipher?: C;
  folder?: FolderView;
}
