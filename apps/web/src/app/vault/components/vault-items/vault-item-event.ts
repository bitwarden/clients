import { CollectionView } from "@bitwarden/admin-console/common";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { CollectionPermission } from "@bitwarden/web-vault/app/admin-console/organizations/shared/components/access-selector";

import { VaultItem } from "./vault-item";

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
  | { type: "assignToCollections"; items: C[] };
