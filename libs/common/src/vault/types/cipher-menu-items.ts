import { CipherType } from "../enums";

/**
 * Represents a menu item for creating a new cipher of a specific type
 */
export type CipherMenuItem = {
  /** The cipher type this menu item represents */
  type: CipherType;
  /** The icon class name (e.g., "bwi-globe") */
  icon: string;
  /** The i18n key for the label text */
  labelKey: string;
  /** The i18n key for the subtitle text */
  subtitleKey: string;
};

/**
 * All available cipher menu items with their associated icons and labels
 */
export const CIPHER_MENU_ITEMS = Object.freeze([
  {
    type: CipherType.Login,
    icon: "bwi-globe",
    labelKey: "typeLogin",
    subtitleKey: "typeLoginSubtitle",
  },
  {
    type: CipherType.Card,
    icon: "bwi-credit-card",
    labelKey: "typeCard",
    subtitleKey: "typeCardSubtitle",
  },
  {
    type: CipherType.Identity,
    icon: "bwi-id-card",
    labelKey: "typeIdentity",
    subtitleKey: "typeIdentitySubtitle",
  },
  {
    type: CipherType.SecureNote,
    icon: "bwi-sticky-note",
    labelKey: "typeNote",
    subtitleKey: "typeNoteSubtitle",
  },
  {
    type: CipherType.SshKey,
    icon: "bwi-key",
    labelKey: "typeSshKey",
    subtitleKey: "typeSshKeySubtitle",
  },
] as const) satisfies readonly CipherMenuItem[];
