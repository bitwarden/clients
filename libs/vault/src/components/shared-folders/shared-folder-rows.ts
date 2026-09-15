import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { cipherInScope, VaultScope, VaultScopeType } from "../../models/vault-scope";

import { SharedFolderPermission } from "./shared-folder-permission";

/** A row of the shared folders table. */
export type SharedFolderRow = {
  id: CollectionId;
  organizationId: OrganizationId;
  name: string;
  permissions: SharedFolderPermission;
  items: number;
  canEdit: boolean;
  canDelete: boolean;

  /** The collection the row was built from, so an action can act on the folder without a lookup. */
  collection: CollectionView;
};

/** The data one organization's shared folder rows are derived from. */
export type SharedFolderRowsParams = {
  organizationId: OrganizationId;

  /**
   * That organization, once the organization list has loaded. While `undefined`, permissions come
   * from the collection's own flags — an admin's or owner's implicit Manage lands once it arrives.
   */
  organization: Organization | undefined;

  /** Every collection the user holds; those of other organizations are dropped. */
  collections: CollectionView[];

  /** Every cipher the user holds, for the item counts. */
  ciphers: CipherViewLike[];
};

/**
 * The organization's shared folders as table rows, with each folder's permission, item count, and
 * what the member may do with it resolved. Shared across clients so they can't disagree on any of
 * the three.
 *
 * The organization's "My items" collection is left out: it's the member's own default collection
 * rather than a shared folder, and the side nav already offers it as its own destination.
 */
export function sharedFolderRows({
  organizationId,
  organization,
  collections,
  ciphers,
}: SharedFolderRowsParams): SharedFolderRow[] {
  const itemCounts = sharedFolderItemCounts(ciphers, organizationId);

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
      items: itemCounts.get(collection.id) ?? 0,
      canEdit: collection.canEdit(organization),
      canDelete: collection.canDelete(organization),
      collection,
    }));
}

/**
 * The member's permission over `collection`, collapsing the `manage` / `readOnly` /
 * `hidePasswords` flags onto one {@link SharedFolderPermission}. Mirrors the access selector's
 * `convertToPermission`, plus the implicit Manage admins and owners hold over every folder.
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
 * How many items each of the organization's folders holds, keyed by collection id. Folders with no
 * items are absent rather than zero.
 *
 * Filtered through {@link cipherInScope} so trashed and archived items are excluded on the same
 * terms as the vault page's folder drill-in. The scope names no collection, so each in-scope
 * cipher is distributed across its own `collectionIds` — one pass over the ciphers total rather
 * than one pass per folder.
 */
export function sharedFolderItemCounts(
  ciphers: CipherViewLike[],
  organizationId: OrganizationId,
): Map<string, number> {
  const scope: VaultScope = { type: VaultScopeType.Organization, organizationId };
  const counts = new Map<string, number>();

  for (const cipher of ciphers) {
    if (!cipherInScope(cipher, scope)) {
      continue;
    }

    for (const collectionId of cipher.collectionIds ?? []) {
      const key = String(collectionId);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return counts;
}
