import { BitwardenIcon } from "@bitwarden/components";

import { SharedFolderRow } from "./shared-folders-table-row";

/**
 * A client-supplied action over the table's selected rows, offered in the bulk actions bar.
 * Supplying at least one is what turns selection on; without any, the table shows no checkboxes.
 *
 * @example
 * ```ts
 * protected readonly bulkActions = computed<SharedFoldersTableBulkAction[]>(() => [
 *   {
 *     id: "delete",
 *     label: this.i18nService.t("delete"),
 *     icon: "bwi-trash",
 *     disabled: (rows) => rows.some((row) => row.items > 0),
 *     run: (rows) => this.deleteSharedFolders(rows.map((row) => row.id)),
 *   },
 * ]);
 * ```
 */
export type SharedFoldersTableBulkAction<R extends SharedFolderRow = SharedFolderRow> = {
  /** Stable identifier. Drives the `@for` track expression. */
  id: string;

  /** Already-translated label. */
  label: string;

  /** Required, unlike on a row action: the bar drops to icon-only buttons when short of room. */
  icon: BitwardenIcon;

  /** Executes the action for every selected row when the bar's button is pressed. */
  run: (rows: readonly R[]) => void | Promise<void>;

  /** Whether the action is unavailable for the current selection. Omit for always-enabled. */
  disabled?: (rows: readonly R[]) => boolean;
};
