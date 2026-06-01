import {
  CollectionAccessSelectionView,
  CollectionAdminView,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { VaultItem } from "@bitwarden/vault";

/** Default row height in pixels; mirrors the legacy table and drives virtual scroll. */
export const RowHeight = 75;

/** Discriminates the two kinds of row a vault table renders. */
export type VaultRowKind = "cipher" | "collection";

/**
 * Fields every vault row carries. The original `cipher` / `collection` ride
 * along for the name-cell icon and the consumer's per-row action templates.
 */
export interface VaultRowBase {
  id: string;
  kind: VaultRowKind;
  name: string;
  cipher?: CipherViewLike;
  collection?: CollectionView;
  /** Per-row policy, resolved by the consumer; gates the actions-column menu items. */
  canEdit?: boolean;
  canDelete?: boolean;
}

// Per-column field contracts. Each shared column component is generic over a row
// type satisfying just the contract it reads, so a column can be reused in any
// table whose row type includes those fields.

/** Read by {@link VaultNameColumnComponent}. */
export interface NameColumnRow extends VaultRowBase {
  subtitle?: string;
}

/** Read by {@link VaultOwnerColumnComponent}. */
export interface OwnerColumnRow extends VaultRowBase {
  organizationId?: string;
}

/** Read by {@link VaultCollectionsColumnComponent}. */
export interface CollectionsColumnRow extends VaultRowBase {
  collectionIds?: string[];
}

/** Read by {@link VaultGroupsColumnComponent}. */
export interface GroupsColumnRow extends VaultRowBase {
  groups?: CollectionAccessSelectionView[];
}

/** Read by {@link VaultPermissionsColumnComponent}. Both fields are policy-derived. */
export interface PermissionsColumnRow extends VaultRowBase {
  permissionText?: string;
  permissionPriority?: number;
}

/** Row type for the individual (personal) vault table: name + owner columns. */
export interface IndividualVaultRow extends NameColumnRow, OwnerColumnRow {}

/** Row type for the organization vault table: name + collections + groups + permissions columns. */
export interface OrgVaultRow
  extends NameColumnRow, CollectionsColumnRow, GroupsColumnRow, PermissionsColumnRow {}

/** Column keys, shared between the column components and the tables' `displayedColumns`. */
export const VaultColumn = Object.freeze({
  Name: "name",
  Owner: "organizationId",
  Collections: "collectionIds",
  Groups: "groups",
  Permissions: "permissionText",
  Actions: "actions",
} as const);

/** Fields common to both row types, derivable from the item alone. */
function baseFields(item: VaultItem<CipherViewLike>): NameColumnRow {
  if (item.cipher != null) {
    const cipher = item.cipher;
    return {
      id: String(cipher.id ?? ""),
      kind: "cipher",
      name: cipher.name,
      subtitle: CipherViewLikeUtils.subtitle(cipher),
      cipher,
    };
  }
  const collection = item.collection;
  return {
    id: String(collection?.id ?? ""),
    kind: "collection",
    name: collection?.name ?? "",
    collection,
  };
}

function organizationId(item: VaultItem<CipherViewLike>): string | undefined {
  const raw = item.cipher?.organizationId ?? item.collection?.organizationId;
  return raw == null ? undefined : String(raw);
}

/** Maps a {@link VaultItem} into an {@link IndividualVaultRow}. */
export function toIndividualVaultRow(item: VaultItem<CipherViewLike>): IndividualVaultRow {
  return { ...baseFields(item), organizationId: organizationId(item) };
}

/**
 * Maps a {@link VaultItem} into an {@link OrgVaultRow}. Policy-derived permission
 * fields are left for the consumer to resolve.
 */
export function toOrgVaultRow(item: VaultItem<CipherViewLike>): OrgVaultRow {
  const collection = item.collection;
  return {
    ...baseFields(item),
    collectionIds: item.cipher?.collectionIds?.map((id) => String(id)),
    groups: collection instanceof CollectionAdminView ? collection.groups : undefined,
  };
}

// Cross-column ordering primitives shared by every column's comparator. The
// per-column sort functions themselves live with their column components.

/** Collections always sort before ciphers, regardless of direction. */
export function prioritizeCollections(a: VaultRowBase, b: VaultRowBase): number {
  if (a.kind === "collection" && b.kind !== "collection") {
    return -1;
  }
  if (a.kind !== "collection" && b.kind === "collection") {
    return 1;
  }
  return 0;
}

/** Locale-aware comparison of row display names. */
export function compareNames(a: VaultRowBase, b: VaultRowBase): number {
  return a.name.localeCompare(b.name);
}
