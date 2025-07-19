import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

/**
 * Represents viewing all collections for an organization
 */
export const All = "all" as CollectionId;

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
  collectionId?: CollectionId;
  folderId?: string;
  organizationId?: OrganizationId;
  type?: RoutedVaultFilterItemType;

  organizationIdParamType?: "path" | "query";
}
