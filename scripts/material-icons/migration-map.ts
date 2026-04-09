/**
 * Icon name migration mapping
 *
 * This file contains the mapping from legacy BWI semantic names to Figma export names.
 * Used during the migration to eliminate the FIGMA_TO_BWI mapping system.
 */

// Maps legacy BWI names to Figma names for migration
// Format: "old-bwi-name": "figma-name"
export const BWI_TO_FIGMA: Record<string, string> = {
  // Status Indicators
  "question-circle": "help",
  "info-circle": "info",
  spinner: "loading",
  "star-f": "star-filled",

  // Actions
  plus: "add",
  "plus-circle": "add-circle",
  clone: "copy",
  "pencil-square": "edit",
  pencil: "edit-alt",
  files: "duplicate",
  import: "upload",
  envelope: "mail",
  popout: "new-window",
  cog: "settings",
  "cog-f": "settings-filled",
  "minus-circle": "subtract-circle",
  eye: "visibility",
  "eye-slash": "visibility-off",
  trash: "delete",

  // Navigation & Menu
  "up-down-btn": "angle-up-down",
  "down-solid": "arrow-filled-down",
  "up-solid": "arrow-filled-up",
  "drag-and-drop": "drag",
  "ellipsis-h": "more-horizontal",
  "ellipsis-v": "more-vertical",
  "exclamation-triangle": "warning",

  // Bitwarden Objects
  collection: "collection",
  "collection-shared": "collection", // Variant - both point to same SVG
  users: "groups",
  "id-card": "identity",
  globe: "login",
  "sticky-note": "note",
  paperclip: "attach",

  // Devices & Platforms
  "user-monitor": "desktop-user",

  // Misc
  premium: "diamond",
  "universal-access": "accessibility",
  shield: "bitwarden-shield",
  bell: "notifications",
  brush: "palette",
  billing: "receipt",
  puzzle: "extension",
  provider: "handshake",
  "lock-encrypted": "encrypted",
  "lock-f": "lock-filled",
  cli: "terminal",
};

// Maps Figma names to additional variant names
// These create one-to-many mappings where a single SVG file generates multiple icon class names
// Format: "figma-name": ["additional-variant-name-1", "additional-variant-name-2"]
export const FIGMA_VARIANTS: Record<string, string[]> = {
  collection: ["collection-shared"], // collection.svg creates both .bwi-collection and .bwi-collection-shared
};
