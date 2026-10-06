import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import {
  getFlatCollectionTree,
  getNestedCollectionTree,
} from "@bitwarden/common/admin-console/utils/collection-utils";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { cipherInScope, VaultScope, VaultScopeType } from "../../models/vault-scope";
import { sharedFolderName } from "../../utils/shared-folder-name";

import { SharedFolderPermission } from "./shared-folder-permission";

/** A row of the shared folders table. */
export type SharedFolderRow = {
  id: CollectionId;
  organizationId: OrganizationId;

  /** The folder's own name, without its parent path — see {@link sharedFolderName}. */
  name: string;

  permissions: SharedFolderPermission;

  /** Items in this folder and every folder nested beneath it, each counted once. */
  items: number;

  /** How many shared folders sit directly inside this one. */
  nestedSharedFolders: number;

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
 * Only top-level folders are listed. Nesting comes from {@link getNestedCollectionTree}, so a
 * folder whose parent the member can't see is listed at the top level, as in the drill-in's card
 * grid.
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
  const sharedFolders = collections.filter(
    (collection) => collection.organizationId === organizationId && !collection.isDefaultCollection,
  );

  // Keyed by id rather than read off the tree, whose nodes are clones renamed to their last path
  // segment. Copied because the helper sorts its argument in place.
  const roots = getNestedCollectionTree([...sharedFolders]);
  const nestedCounts = new Map(roots.map((root) => [root.node.id, root.children.length]));

  // Each folder's top-level ancestor, or itself for a top-level folder.
  const rootOf = new Map<string, string>();
  for (const root of roots) {
    for (const descendant of getFlatCollectionTree([root])) {
      rootOf.set(descendant.id, root.node.id);
    }
  }
  const itemCounts = sharedFolderItemCounts(ciphers, organizationId, (collectionId) =>
    rootOf.get(collectionId),
  );

  return sharedFolders
    .filter((collection) => nestedCounts.has(collection.id))
    .map((collection) => ({
      id: collection.id,
      organizationId: collection.organizationId,
      name: sharedFolderName(collection),
      permissions: sharedFolderPermission(collection, organization),
      items: itemCounts.get(collection.id) ?? 0,
      nestedSharedFolders: nestedCounts.get(collection.id) ?? 0,
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
 *
 * `groupOf` pools folders under a shared key — e.g. each folder under its top-level ancestor — and
 * a cipher in several folders of one group counts toward it once. A folder it maps to `undefined`
 * is left uncounted. Defaults to each folder being its own group.
 */
export function sharedFolderItemCounts(
  ciphers: CipherViewLike[],
  organizationId: OrganizationId,
  groupOf: (collectionId: string) => string | undefined = (collectionId) => collectionId,
): Map<string, number> {
  const scope: VaultScope = { type: VaultScopeType.Organization, organizationId };
  const counts = new Map<string, number>();

  for (const cipher of ciphers) {
    if (!cipherInScope(cipher, scope)) {
      continue;
    }

    const groups = new Set<string>();
    for (const collectionId of cipher.collectionIds ?? []) {
      const group = groupOf(String(collectionId));
      if (group !== undefined) {
        groups.add(group);
      }
    }

    for (const group of groups) {
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
  }

  return counts;
}
