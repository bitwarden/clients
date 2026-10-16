/**
 * Every `bit-table-v2` `stateKey`. Bind the property name; the value is what's stored, so
 * changing a value discards every preference saved under it.
 */
export const TABLE_STATE_KEYS = Object.freeze({
  /** The vault items table, shared by web and desktop. */
  vaultItems: "vault-items",
} as const);

export type TableStateKey = keyof typeof TABLE_STATE_KEYS;
