/**
 * What a member may do with a shared folder. Mirrors the access selector's permissions: a
 * collection's `readOnly` / `hidePasswords` / `manage` flags collapse onto exactly one of these.
 *
 * Clients pass the permission rather than a label so the table can translate it and keep the
 * URL-synced filter value locale-independent.
 */
export const SharedFolderPermission = Object.freeze({
  ViewExceptPass: "viewExceptPass",
  View: "view",
  EditExceptPass: "editExceptPass",
  Edit: "edit",

  /** Full control. Organization admins and owners hold this over every folder. */
  Manage: "manage",
} as const);

export type SharedFolderPermission =
  (typeof SharedFolderPermission)[keyof typeof SharedFolderPermission];

/**
 * Every permission in display order — how the permissions column sorts and the filter menu lists.
 * Grouped view, then edit, then manage, matching how permissions are offered when assigned.
 */
export const SHARED_FOLDER_PERMISSIONS: readonly SharedFolderPermission[] = Object.freeze([
  SharedFolderPermission.ViewExceptPass,
  SharedFolderPermission.View,
  SharedFolderPermission.EditExceptPass,
  SharedFolderPermission.Edit,
  SharedFolderPermission.Manage,
]);

const PERMISSION_MESSAGE_KEYS: Readonly<Record<SharedFolderPermission, string>> = Object.freeze({
  [SharedFolderPermission.ViewExceptPass]: "viewItemsHidePass",
  [SharedFolderPermission.View]: "viewItems",
  [SharedFolderPermission.EditExceptPass]: "editItemsHidePass",
  [SharedFolderPermission.Edit]: "editItems",
  [SharedFolderPermission.Manage]: "manage",
});

export function isSharedFolderPermission(value: unknown): value is SharedFolderPermission {
  return SHARED_FOLDER_PERMISSIONS.includes(value as SharedFolderPermission);
}

/** The i18n key naming `permission`, e.g. `"editItemsHidePass"`. */
export function sharedFolderPermissionMessageKey(permission: SharedFolderPermission): string {
  return PERMISSION_MESSAGE_KEYS[permission];
}

/**
 * Where `permission` falls in {@link SHARED_FOLDER_PERMISSIONS}, for ordering. Unknown values sort
 * last rather than throwing, so an unrecognized permission still renders.
 */
export function sharedFolderPermissionOrder(permission: SharedFolderPermission): number {
  const index = SHARED_FOLDER_PERMISSIONS.indexOf(permission);
  return index === -1 ? SHARED_FOLDER_PERMISSIONS.length : index;
}
