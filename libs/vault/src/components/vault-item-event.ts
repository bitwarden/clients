import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { CollectionPermission } from "@bitwarden/common/admin-console/models/organizations";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { VaultItem } from "@bitwarden/vault";

export type VaultItemEvent<C extends CipherViewLike> =
  | { type: "viewAttachments"; item: C }
  | { type: "bulkEditCollectionAccess"; items: CollectionView[] }
  | {
      type: "viewCollectionAccess";
      item: CollectionView;
      readonly: boolean;
      initialPermission?: CollectionPermission;
    }
  | { type: "viewEvents"; item: C }
  | { type: "editCollection"; item: CollectionView; readonly: boolean }
  | { type: "clone"; item: C }
  | { type: "restore"; items: C[] }
  | { type: "delete"; items: VaultItem<C>[] }
  | { type: "copyField"; item: C; field: "username" | "password" | "totp" }
  | { type: "moveToFolder"; items: C[] }
  | { type: "assignToCollections"; items: C[] }
  | { type: "archive"; items: C[] }
  | { type: "unarchive"; items: C[] }
  | { type: "toggleFavorite"; item: C }
  | { type: "editCipher"; item: C };
