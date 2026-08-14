/**
 * How the built-in Copy quick action presents itself.
 *
 * - `"collapsed"` — a single Copy button, opening a menu when the row has more than one copyable
 *   field. Narrow, so the actions column stays compact.
 * - `"expanded"` — one button per copyable field. Faster to reach a specific field, at the cost
 *   of a much wider actions column.
 */
export type VaultItemsTableCopyPresentation = "collapsed" | "expanded";

/**
 * Collapsed is the default because `expanded` widens the actions column by ~80px, which pushes
 * the table's minimum width past common viewports and forces horizontal scrolling.
 */
export const DEFAULT_COPY_PRESENTATION: VaultItemsTableCopyPresentation = "collapsed";
