/**
 * What a member may do with a shared folder.
 *
 * Mirrors the permissions offered by the access selector — the `readOnly` / `hidePasswords` /
 * `manage` flags a client holds collapse onto exactly one of these. Clients pass the permission
 * rather than a label so the table can translate it, order the column and the filter menu
 * consistently, and keep the URL-synced filter value locale-independent.
 */
export const SharedFolderPermission = Object.freeze({
  ViewExceptPass: "viewExceptPass",
  View: "view",
  EditExceptPass: "editExceptPass",
  Edit: "edit",

  /** Full control of the folder. What an organization's admins and owners hold over every folder. */
  Manage: "manage",
} as const);

export type SharedFolderPermission =
  (typeof SharedFolderPermission)[keyof typeof SharedFolderPermission];

/**
 * Every permission in display order — the order the permissions column sorts by and the
 * Permissions filter menu lists. Grouped view, then edit, then manage rather than ranked by how
 * much access each grants, matching how the permission is offered when it's assigned.
 */
export const SHARED_FOLDER_PERMISSIONS: readonly SharedFolderPermission[] = Object.freeze([
  SharedFolderPermission.ViewExceptPass,
  SharedFolderPermission.View,
  SharedFolderPermission.EditExceptPass,
  SharedFolderPermission.Edit,
  SharedFolderPermission.Manage,
]);

/** The i18n key naming each permission. */
const PERMISSION_MESSAGE_KEYS: Readonly<Record<SharedFolderPermission, string>> = Object.freeze({
  [SharedFolderPermission.ViewExceptPass]: "viewItemsHidePass",
  [SharedFolderPermission.View]: "viewItems",
  [SharedFolderPermission.EditExceptPass]: "editItemsHidePass",
  [SharedFolderPermission.Edit]: "editItems",
  [SharedFolderPermission.Manage]: "manage",
});

/** Type guard for {@link SharedFolderPermission}. */
export function isSharedFolderPermission(value: unknown): value is SharedFolderPermission {
  return SHARED_FOLDER_PERMISSIONS.includes(value as SharedFolderPermission);
}

/**
 * The i18n key naming `permission`, e.g. `"editItemsHidePass"`. Pass it through `I18nPipe` or
 * `I18nService.t()` to get the label.
 */
export function sharedFolderPermissionMessageKey(permission: SharedFolderPermission): string {
  return PERMISSION_MESSAGE_KEYS[permission];
}

/**
 * Where `permission` falls in {@link SHARED_FOLDER_PERMISSIONS}, for ordering. Unknown values sort
 * last rather than throwing — a row is still worth rendering when its permission isn't one the
 * table knows.
 */
export function sharedFolderPermissionOrder(permission: SharedFolderPermission): number {
  const index = SHARED_FOLDER_PERMISSIONS.indexOf(permission);
  return index === -1 ? SHARED_FOLDER_PERMISSIONS.length : index;
}
