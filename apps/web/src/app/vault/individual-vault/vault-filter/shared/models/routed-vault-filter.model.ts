export const All = "all";

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
  collectionId?: string;
  folderId?: string;
  organizationId?: string;
  type?: RoutedVaultFilterItemType;

  organizationIdParamType?: "path" | "query";
}
