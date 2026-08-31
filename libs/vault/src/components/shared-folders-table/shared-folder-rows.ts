import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { cipherInScope, VaultScope, VaultScopeType } from "../../models/vault-scope";

import { SharedFolderPermission } from "./shared-folder-permission";
import { SharedFolderRow } from "./shared-folders-table-row";

/**
 * A row carrying the `CollectionView` it was built from, so a client's row and bulk actions can act
 * on the folder without looking it up again. The table is generic over anything assignable to
 * {@link SharedFolderRow}, so the extra field stays typed through to each action's callbacks.
 */
export type SharedFolderCollectionRow = SharedFolderRow & { collection: CollectionView };

/** The data one organization's shared folder rows are derived from. */
export type SharedFolderRowsParams = {
  /** The organization whose folders to list, as the route names it. */
  organizationId: OrganizationId;

  /**
   * That organization, once the organization list has loaded. `undefined` meanwhile, which resolves
   * every permission from the collection's own flags — an admin's or owner's implicit Manage lands
   * once the organization arrives.
   */
  organization: Organization | undefined;

  /** Every collection the user holds; those of other organizations are dropped. */
  collections: CollectionView[];

  /** Every cipher the user holds, for the item counts. */
  ciphers: CipherViewLike[];
};

/**
 * The organization's shared folders as table rows, with each folder's permission and item count
 * resolved.
 *
 * The organization's "My items" collection is left out: it is the member's own default collection
 * rather than a folder shared with anyone, and the side nav already offers it as its own
 * destination.
 *
 * Shared rather than derived per client so every client's list agrees on which collections are
 * shared folders and on what the member may do with each — the two questions a client would
 * otherwise have to answer for itself, and disagree on.
 */
export function sharedFolderRows({
  organizationId,
  organization,
  collections,
  ciphers,
}: SharedFolderRowsParams): SharedFolderCollectionRow[] {
  return collections
    .filter(
      (collection) =>
        collection.organizationId === organizationId && !collection.isDefaultCollection,
    )
    .map((collection) => ({
      id: collection.id,
      organizationId: collection.organizationId,
      name: collection.name,
      permissions: sharedFolderPermission(collection, organization),
      items: sharedFolderItemCount(ciphers, organizationId, collection),
      collection,
    }));
}

/**
 * The member's permission over `collection`, collapsing the `manage` / `readOnly` /
 * `hidePasswords` flags onto one {@link SharedFolderPermission} — mirroring the access selector's
 * `convertToPermission`, plus the implicit Manage an organization's admins and owners hold over
 * every folder.
 */
export function sharedFolderPermission(
  collection: CollectionView,
  organization: Organization | undefined,
): SharedFolderPermission {
  if (organization?.canEditAllCiphers || collection.manage) {
    return SharedFolderPermission.Manage;
  }

  if (collection.readOnly) {
    return collection.hidePasswords
      ? SharedFolderPermission.ViewExceptPass
      : SharedFolderPermission.View;
  }

  return collection.hidePasswords
    ? SharedFolderPermission.EditExceptPass
    : SharedFolderPermission.Edit;
}

/**
 * How many items the folder holds, counted through {@link cipherInScope} rather than by matching
 * `collectionIds` directly — so the count excludes trashed and archived items on the same terms
 * the vault page's own folder drill-in does, and the two can't drift.
 */
export function sharedFolderItemCount(
  ciphers: CipherViewLike[],
  organizationId: OrganizationId,
  collection: CollectionView,
): number {
  const scope: VaultScope = {
    type: VaultScopeType.Organization,
    organizationId,
    collectionId: collection.id,
  };

  return ciphers.filter((cipher) => cipherInScope(cipher, scope)).length;
}
