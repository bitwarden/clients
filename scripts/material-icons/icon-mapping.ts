/**
 * Mapping from BWI icon names to Material Icon names
 *
 * This mapping is used to generate a new BWI font file where each BWI icon name
 * maps to a Material Design icon glyph.
 *
 * Source: Figma design file - Icon mapping tables
 * https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library
 *
 * Last updated: 2025-12-04
 */

export const BWI_TO_MATERIAL_MAPPING = {
  // ============================================
  // STATUS INDICATORS
  // ============================================
  "bwi-check": "check",
  "bwi-error": "error",
  "bwi-info-circle": "info", // Was: bwi-info-circle
  "bwi-spinner": "sync", // Was: bwi-spinner (loading/spinner icon)
  "bwi-question-circle": "help", // Was: bwi-question-circle
  "bwi-exclamation-triangle": "warning", // Was: bwi-exclamation-triangle

  // ============================================
  // BITWARDEN OBJECTS
  // ============================================
  "bwi-business": "business",
  "bwi-collection": "folder_shared",
  "bwi-collection-shared": "folder_shared", // Remove this - use collection instead
  "bwi-credit-card": "credit_card",
  "bwi-dashboard": "dashboard",
  "bwi-family": "family_restroom",
  "bwi-folder": "folder",
  "bwi-user": "person", // Was: bwi-users (singular)
  "bwi-users": "group", // Was: bwi-users (plural)
  "bwi-id-card": "badge", // Was: bwi-id-card
  "bwi-globe": "public", // login item type
  "bwi-sticky-note": "sticky_note_2", // Was: bwi-sticky-note
  "bwi-send": "send",
  "bwi-vault": "inventory_2",

  // ============================================
  // ACTIONS
  // ============================================
  "bwi-plus": "add", // Was: bwi-plus
  "bwi-plus-circle": "add_circle", // Was: bwi-plus-circle
  "bwi-archive": "archive",
  "bwi-import": "upload_file", // Was: bwi-import (autofill is new)
  "bwi-check-circle": "check_circle",
  "bwi-clone": "content_copy", // Was: bwi-clone
  "bwi-close": "close",
  "bwi-download": "download",
  "bwi-pencil": "edit", // Was: bwi-pencil
  "bwi-pencil-square": "edit_note", // Was: bwi-pencil-square
  "bwi-lock-encrypted": "enhanced_encryption", // Was: bwi-lock-encrypted
  "bwi-external-link": "open_in_new",
  "bwi-files": "content_copy", // Was: bwi-files (duplicate action)
  "bwi-generate": "cached", // Was: bwi-generate
  "bwi-lock": "lock",
  "bwi-lock-f": "lock", // Was: bwi-lock-f (filled version)
  "bwi-envelope": "mail",
  "bwi-sign-in": "login",
  "bwi-sign-out": "logout",
  "bwi-popout": "open_in_new", // Was: bwi-popout (new-window)
  "bwi-refresh": "refresh",
  "bwi-search": "search",
  "bwi-cog": "settings", // Was: bwi-cog
  "bwi-cog-f": "settings", // Was: bwi-cog-f (filled version)
  "bwi-share": "share",
  "bwi-star": "star_outline",
  "bwi-star-f": "star",
  "bwi-minus-circle": "remove_circle", // Was: bwi-minus-circle (subtract-circle)
  "bwi-trash": "delete",
  "bwi-undo": "undo",
  "bwi-unlock": "lock_open",
  "bwi-eye": "visibility", // Was: bwi-eye
  "bwi-eye-slash": "visibility_off", // Was: bwi-eye-slash

  // ============================================
  // ARROWS AND MENUS
  // ============================================
  "bwi-angle-down": "keyboard_arrow_down",
  "bwi-angle-left": "keyboard_arrow_left",
  "bwi-angle-right": "keyboard_arrow_right",
  "bwi-angle-up": "keyboard_arrow_up",
  "bwi-up-down-btn": "unfold_more", // Was: bwi-up-down-btn (angle-up-down)
  "bwi-down-solid": "arrow_drop_down", // Was: bwi-down-solid (arrow-filled-down)
  "bwi-up-solid": "arrow_drop_up", // Was: bwi-up-solid (arrow-filled-up)
  "bwi-drag-and-drop": "drag_indicator", // Was: bwi-drag-and-drop (drag)
  "bwi-ellipsis-h": "more_horiz",
  "bwi-ellipsis-v": "more_vert",
  "bwi-filter": "filter_list",
  "bwi-list-alt": "view_agenda", // Was: bwi-filter (grid)
  "bwi-list": "list",
  "bwi-numbered-list": "format_list_numbered", // Was: bwi-numbered-list (list-alt)
  "bwi-sliders": "tune",

  // ============================================
  // MISCELLANEOUS
  // ============================================
  "bwi-universal-access": "accessibility", // Was: bwi-universal-access
  "bwi-paperclip": "attach_file", // Was: bwi-paperclip (attachment)
  "bwi-shield": "shield", // Was: bwi-shield (bitwarden-shield)
  "bwi-browser": "web",
  "bwi-bug": "bug_report",
  "bwi-camera": "photo_camera",
  "bwi-clock": "schedule",
  "bwi-desktop": "computer",
  "bwi-dollar": "attach_money", // Was: bwi-dollar
  "bwi-puzzle": "extension",
  "bwi-file": "description",
  "bwi-file-text": "article",
  "bwi-hashtag": "tag",
  "bwi-key": "vpn_key",
  "bwi-mobile": "smartphone",
  "bwi-msp": "business_center",
  "bwi-brush": "palette", // Was: bwi-brush
  "bwi-passkey": "password", // Was: bwi-passkey (using password icon)
  "bwi-bell": "notifications", // Was: bwi-bell (notifications)
  "bwi-billing": "receipt",
  "bwi-cli": "terminal",
  "bwi-tag": "label",
  "bwi-provider": "handshake", // Was: bwi-provider
  "bwi-wireless": "wifi",
  "bwi-wrench": "build",

  // ============================================
  // 3RD PARTY PLATFORMS AND LOGOS
  // ============================================
  "bwi-bitcoin": "currency_bitcoin",
  "bwi-paypal": "payments",
} as const;

/**
 * Material Icon names that are NEW and don't have BWI equivalents
 * These should be added to the component library as new icons
 */
export const NEW_MATERIAL_ICONS = {
  autofill: "login", // New icon for autofill feature
  clear: "backspace", // New icon, differentiated from error
  redo: "redo", // New icon, should be coupled with undo
  subtract: "remove", // New icon (no outline version)
  "arrow-down": "south", // New icon for directional arrows
  "arrow-left": "west", // New icon
  "arrow-right": "east", // New icon
  "arrow-up": "north", // New icon
  "arrow-filled-left": "arrow_back", // New icon
  "arrow-filled-right": "arrow_forward", // New icon
  diamond: "diamond", // New icon for premium plans
  sso: "cloud", // New icon for single-sign-on
  "edit-alt": "edit", // Alternative edit icon
  duplicate: "content_copy", // Was: bwi-files
  "file-upload": "upload_file", // Was: bwi-import
  unarchive: "unarchive", // New icon
  grid: "grid_view", // Was: bwi-filter (different usage)
} as const;

export type BwiIconName = keyof typeof BWI_TO_MATERIAL_MAPPING;
export type MaterialIconName = (typeof BWI_TO_MATERIAL_MAPPING)[BwiIconName];
export type NewMaterialIconName = keyof typeof NEW_MATERIAL_ICONS;

/**
 * Get Material Icon name from BWI icon name
 */
export function getMaterialIconName(bwiName: string): string | undefined {
  return BWI_TO_MATERIAL_MAPPING[bwiName as BwiIconName];
}

/**
 * Check if BWI icon has a Material Icon mapping
 */
export function hasMaterialMapping(bwiName: string): boolean {
  return bwiName in BWI_TO_MATERIAL_MAPPING;
}

/**
 * Get all BWI icon names that have Material mappings
 */
export function getMappedBwiIcons(): readonly BwiIconName[] {
  return Object.keys(BWI_TO_MATERIAL_MAPPING) as BwiIconName[];
}

/**
 * Get all Material icon names used in mappings
 */
export function getMappedMaterialIcons(): readonly MaterialIconName[] {
  return Object.values(BWI_TO_MATERIAL_MAPPING);
}

/**
 * Icons that need attention based on Figma notes
 */
export const ICON_NOTES = {
  "bwi-collection-shared": "Remove this icon. Replace all instances with bwi-collection",
  "bwi-pencil-square": "Question: When should this be used in place of the edit-alt version?",
  "bwi-pencil": "Question: Move this icon from Misc Objects to Actions?",
  "bwi-down-solid":
    "All instances of the solid arrow used in tables to indicate sort order descending should be replaced with arrow-down",
  "bwi-up-solid":
    "All instances of the solid arrow used in tables to indicate sort order ascending should be replaced with arrow-up",
  "bwi-provider":
    "Replace instances of 'provider' icon used to indicate single-sign-on with the new sso icon",
  "bwi-filter":
    "Consider replacing the current sliders icon in the browser extension for this more standard filter icon",
  "bwi-brush": "Replace current 'brush' icon",
} as const;
