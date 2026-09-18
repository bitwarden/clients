import { UserKeyDefinition, VAULT_FILTER_DISK } from "../../../platform/state";

export const COLLAPSED_GROUPINGS = UserKeyDefinition.array<string>(
  VAULT_FILTER_DISK,
  "collapsedGroupings",
  {
    deserializer: (obj) => obj,
    clearOn: ["logout", "lock"],
  },
);

/**
 * Tracks which vault-filter tree nodes (organizations, collections, folders, cipher types, and
 * any other collapsible section id) the user has collapsed, independent of
 * {@link COLLAPSED_GROUPINGS}.
 *
 * Deliberately omits "lock" from `clearOn`: unlike the session-scoped collapse state above, this
 * preference must survive an app restart, and Desktop's default Vault Timeout Action locks the
 * vault on every restart — so a "lock" clear-on would wipe it before it could ever be read back.
 */
export const PERSISTED_COLLAPSED_VAULT_FILTER_NODES = UserKeyDefinition.array<string>(
  VAULT_FILTER_DISK,
  "persistedCollapsedVaultFilterNodes",
  {
    deserializer: (obj) => obj,
    clearOn: ["logout"],
  },
);
