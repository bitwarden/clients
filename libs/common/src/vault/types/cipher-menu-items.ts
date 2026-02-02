import { CipherType } from "../enums";

/**
 * Represents a menu item for creating a new cipher of a specific type
 */
export type CipherMenuItem = {
  /** The cipher type this menu item represents */
  type: CipherType;
  /** The icon class name (e.g., "bwi-login") */
  icon: string;
  /** The i18n key for the label text */
  labelKey: string;
};

/**
 * All available cipher menu items with their associated icons and labels
 */
export const CIPHER_MENU_ITEMS = Object.freeze([
  { type: CipherType.Login, icon: "bwi-login", labelKey: "typeLogin" },
  { type: CipherType.Card, icon: "bwi-credit-card", labelKey: "typeCard" },
  { type: CipherType.Identity, icon: "bwi-identity", labelKey: "typeIdentity" },
  { type: CipherType.SecureNote, icon: "bwi-note", labelKey: "typeNote" },
  { type: CipherType.SshKey, icon: "bwi-key", labelKey: "typeSshKey" },
] as const) satisfies readonly CipherMenuItem[];
