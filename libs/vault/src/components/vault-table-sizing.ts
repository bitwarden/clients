/**
 * Sizing shared by the vault's virtualized `bit-table-v2` tables — `vault-items-table` and
 * `vault-shared-folders` — so the two keep the same row height, floor, and bulk-bar clearance.
 */

/**
 * Bottom margin (px) held while the bulk-actions bar shows — its height (53). The bar is
 * `position: fixed`, so without this the last row sits underneath it and is unreachable.
 */
export const BULK_BAR_CLEARANCE = 53;

/** Fixed height (px) of a row. The table virtualizes, so rows can't size to their content. */
export const VAULT_TABLE_ROW_HEIGHT = 56;

/** Rows the table stays tall enough to show. */
const MIN_ROWS = 5;

/**
 * Height (px) of the chrome above the rows: the toolbar's search row (a 40px field plus `py-5`)
 * and its 60px filter row, then the 48px header row. Approximate by design — it only backs a
 * minimum, so chrome that grows later costs a fraction of a row rather than breaking the layout.
 */
const TABLE_CHROME_HEIGHT = 188;

/**
 * Floor (px) for the table's height. Content above it on the page — the shared folder card grid
 * most of all — takes its natural height, so without a floor the table is what gives way, down to
 * a row or two on a short viewport. Below this the page scrolls instead.
 */
export const VAULT_TABLE_MIN_HEIGHT = MIN_ROWS * VAULT_TABLE_ROW_HEIGHT + TABLE_CHROME_HEIGHT;
