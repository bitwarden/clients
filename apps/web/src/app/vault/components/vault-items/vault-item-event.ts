import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { VaultItemEvent as BaseVaultItemEvent } from "@bitwarden/vault";
import { CollectionPermission } from "@bitwarden/web-vault/app/admin-console/organizations/shared/components/access-selector";

// Extend base events with web-specific events
export type VaultItemEvent<C extends CipherViewLike> =
  | BaseVaultItemEvent<C>
  | { type: "copyField"; item: C; field: "username" | "password" | "totp" }
  | { type: "bulkEditCollectionAccess"; items: CollectionView[] }
  | {
      type: "viewCollectionAccess";
      item: CollectionView;
      readonly: boolean;
      initialPermission?: CollectionPermission;
    }
  | { type: "editCollection"; item: CollectionView; readonly: boolean };
