import { BitwardenIcon } from "@bitwarden/components";

import { SharedFolderPermission } from "./shared-folder-permission";

/**
 * A row of the shared folders table. Clients may pass a richer type — the table is generic over
 * anything assignable to this shape, so the extra fields stay available to {@link
 * SharedFoldersTableRowAction} callbacks.
 */
export type SharedFolderRow = {
  /** Stable identifier. Drives `trackBy`, the menu item QA ids, and the `@for` track expression. */
  id: string;

  name: string;

  /**
   * What the member may do with the folder. The table translates it; resolving the permission
   * stays with the client, including collapsing an organization admin's or owner's implicit access
   * to every folder down to {@link SharedFolderPermission.Manage}.
   */
  permissions: SharedFolderPermission;

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
