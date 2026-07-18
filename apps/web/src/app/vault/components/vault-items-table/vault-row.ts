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
 * Flat, presentational view-model for a vault row. The consumer maps each
 * {@link VaultItem} into one of these (see {@link toVaultRow}) and resolves the
 * policy-derived fields (permission text/weight and the per-row capability
 * flags) itself. The original `cipher` / `collection` ride along for the
 * name-cell icon.
 */
export interface VaultRow {
  id: string;
  kind: VaultRowKind;
  name: string;
  subtitle?: string;
  organizationId?: string;
  collectionIds?: string[];
  groups?: CollectionAccessSelectionView[];
  permissionText?: string;
  permissionPriority?: number;
  canEdit?: boolean;
  canDelete?: boolean;
  canArchive?: boolean;
  canEditAccess?: boolean;
  cipher?: CipherViewLike;
  collection?: CollectionView;
}

/** Column keys, shared between the table's cell defs and its `displayedColumns`. */
export const VaultColumn = Object.freeze({
  Name: "name",
  Owner: "organizationId",
  Collections: "collectionIds",
  Groups: "groups",
  Permissions: "permissionText",
  Actions: "actions",
} as const);

/**
 * Maps a {@link VaultItem} into a {@link VaultRow}. Policy-derived fields
 * (permissions, per-row capability flags) are left for the consumer to resolve.
 */
export function toVaultRow(item: VaultItem<CipherViewLike>): VaultRow {
  if (item.cipher != null) {
    const cipher = item.cipher;
    return {
      id: String(cipher.id ?? ""),
      kind: "cipher",
      name: cipher.name,
      subtitle: CipherViewLikeUtils.subtitle(cipher),
      organizationId: cipher.organizationId == null ? undefined : String(cipher.organizationId),
      collectionIds: cipher.collectionIds?.map((id) => String(id)),
      cipher,
    };
  }

  const collection = item.collection;
  return {
    id: String(collection?.id ?? ""),
    kind: "collection",
    name: collection?.name ?? "",
    organizationId:
      collection?.organizationId == null ? undefined : String(collection.organizationId),
    groups: collection instanceof CollectionAdminView ? collection.groups : undefined,
    collection,
  };
}

/** Collections always sort before ciphers, regardless of direction. */
export function prioritizeCollections(a: VaultRow, b: VaultRow): number {
  if (a.kind === "collection" && b.kind !== "collection") {
    return -1;
  }
  if (a.kind !== "collection" && b.kind === "collection") {
    return 1;
  }
  return 0;
}

/** Locale-aware comparison of row display names. */
export function compareNames(a: VaultRow, b: VaultRow): number {
  return a.name.localeCompare(b.name);
}
