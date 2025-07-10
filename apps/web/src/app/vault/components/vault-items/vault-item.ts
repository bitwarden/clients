import { CollectionView } from "@bitwarden/admin-console/common";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

export interface VaultItem {
  collection?: CollectionView;
  cipher?: CipherView;
}
