/**
 * Every `bit-table-v2` `customizeKey`, collected here — as `state-definitions.ts` does for
 * state names — so `table-customize-keys.spec.ts` can hold them to being unique. Two tables
 * sharing a key would silently share one stored set of hidden columns.
 *
 * A key is a persistence identity, not a label: once shipped it is the only way to find a
 * user's stored choice again, so renaming one discards every preference saved under it.
 */

/** The vault items table, shared by web and desktop. */
export const VAULT_ITEMS_CUSTOMIZE_KEY = "vault-items";
