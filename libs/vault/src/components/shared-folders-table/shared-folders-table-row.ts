import { BitwardenIcon } from "@bitwarden/components";

/**
 * A row of the shared folders table. Clients may pass a richer type — the table is generic over
 * anything assignable to this shape, so the extra fields stay available to {@link
 * SharedFoldersTableRowAction} callbacks.
 *
 * {@link permissions} is an already-translated label rather than a permission enum: what a
 * permission is called differs by caller (an org member's access level, a collection's assigned
 * permission), and resolving that is the client's concern, not the table's.
 */
export type SharedFolderRow = {
  /** Stable identifier. Drives `trackBy`, the menu item QA ids, and the `@for` track expression. */
  id: string;

  name: string;

  /** Already-translated permission label, e.g. "Can edit". */
  permissions: string;

  /** How many vault items the folder holds. */
  items: number;
};

/**
 * A client-supplied action for a row's Options menu.
 *
 * @example
 * ```ts
 * protected readonly rowActions = computed<SharedFoldersTableRowAction[]>(() => [
 *   {
 *     id: "edit",
 *     label: this.i18nService.t("edit"),
 *     icon: "bwi-pencil-square",
 *     run: (row) => this.editSharedFolder(row.id),
 *   },
 * ]);
 * ```
 */
export type SharedFoldersTableRowAction<R extends SharedFolderRow = SharedFolderRow> = {
  /** Stable identifier. Drives the menu item's QA id and the `@for` track expression. */
  id: string;

  /** Already-translated label. */
  label: string;

  icon: BitwardenIcon;

  /** Executes the action for `row` when the menu item is chosen. */
  run: (row: R) => void | Promise<void>;

  /** Whether the action shows for `row`. Omit for always-shown. */
  show?: (row: R) => boolean;

  /** Menu item styling, passed straight to `bitMenuItem`. Defaults to `"primary"`. */
  variant?: "primary" | "danger";
};
