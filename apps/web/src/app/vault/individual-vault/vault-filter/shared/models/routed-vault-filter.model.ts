import { Unassigned } from "@bitwarden/admin-console/common";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

/**
 * A constant used to represent viewing "all" of a particular filter.
 */
export const All = "all";
export type All = typeof All;

// TODO: Remove `All` when moving to vertical navigation.
const itemTypes = [
  "favorites",
  "login",
  "card",
  "identity",
  "note",
  "sshKey",
  "trash",
  All,
] as const;

export type RoutedVaultFilterItemType = (typeof itemTypes)[number];

export function isRoutedVaultFilterItemType(value: unknown): value is RoutedVaultFilterItemType {
  return itemTypes.includes(value as any);
}

export interface RoutedVaultFilterModel {
  collectionId?: CollectionId | All | Unassigned;
  folderId?: string;
  organizationId?: OrganizationId | Unassigned;
  type?: RoutedVaultFilterItemType;

  organizationIdParamType?: "path" | "query";
}
