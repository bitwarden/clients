import { CipherType } from "@bitwarden/common/vault/enums";

/**
 * The `key` values for each filter chip in the vault table.
 * Export these so consumers (the guard, deep-link builders) can reference them
 * without coupling to string literals that diverge over time.
 */
export const VAULT_FILTER_KEYS = Object.freeze({
  type: "type",
  favorites: "favorites",
  vault: "vault",
  sharedFolder: "sharedFolder",
  folder: "folder",
  search: "search",
} as const);

/** The shape of {@link BitTableV2Component.filterValues} for this table. */
export type VaultItemsTableFilters = {
  /**
   * Reserved key — the table adopts a projected `bit-search` under it automatically. It carries the
   * term for seeding, URL sync, and Clear all, but matching runs through `SearchService` rather
   * than off this value — see {@link VaultItemsTableComponent.filter}.
   */
  search?: string;
  type?: CipherType;
  favorites?: boolean;
  /** Organization ids, or {@link MY_VAULT}. Multi-select: a cipher matches any selected value. */
  vault?: string[];
  /** Collection ids. Multi-select: a cipher matches any selected collection. */
  sharedFolder?: string[];
  /** Folder ids, or {@link NO_FOLDER}. Multi-select: a cipher matches any selected value. */
  folder?: string[];
};
