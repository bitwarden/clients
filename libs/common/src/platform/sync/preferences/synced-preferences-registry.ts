import { KeyDefinition, UserKeyDefinition, SYNC_SETTINGS_DISK } from "@bitwarden/state";

import {
  AUTOFILL_ON_PAGE_LOAD,
  AUTOFILL_ON_PAGE_LOAD_DEFAULT,
  AUTO_COPY_TOTP,
  SHOW_INLINE_MENU_IDENTITIES,
  SHOW_INLINE_MENU_CARDS,
} from "../../../autofill/services/autofill-settings.service";
import { ENABLE_BADGE_COUNTER } from "../../../autofill/services/badge-settings.service";
import {
  DEFAULT_URI_MATCH_STRATEGY,
  SHOW_FAVICONS,
} from "../../../autofill/services/domain-settings.service";
import { ClientType } from "../../../enums";
import {
  VAULT_TIMEOUT,
  VAULT_TIMEOUT_ACTION,
} from "../../../key-management/vault-timeout/services/vault-timeout-settings.state";
import { COPY_BUTTON } from "../../../vault/services/key-state/vault-appearance.state";
import {
  SHOW_CARDS_CURRENT_TAB,
  SHOW_IDENTITIES_CURRENT_TAB,
  CLICK_ITEMS_AUTOFILL_VAULT_VIEW,
} from "../../../vault/services/key-state/vault-settings.state";
import { ROUTING_ANIMATION } from "../../abstractions/animation-control.service";
import { LOCALE_KEY } from "../../services/i18n.service";
import { POPUP_WIDTH } from "../../services/popup-size.state";
import { COMPACT_MODE } from "../../theming/compact-mode.state";
import { THEME_SELECTION } from "../../theming/theme-state.service";

import { SharedPreferences, DevicePreferences, BrowserPreferences } from "./synced-preferences";

// ── Sync scope types ──

export const SyncScope = Object.freeze({
  /**
   * For preferences that are synced across all client types
   */
  Shared: "shared",

  /**
   * For preferences that are only synced between devices of the same client type (e.g. only browsers, or only desktops).
   */
  Device: "device",
} as const);
export type SyncScope = (typeof SyncScope)[keyof typeof SyncScope];

// ── Registry entry ──

interface SyncedKeyEntryBase {
  /** The UserKeyDefinition that owns this state in the StateProvider */
  keyDef: UserKeyDefinition<unknown>;
  global?: never;
}

interface SyncedGlobalKeyEntryBase {
  /** The KeyDefinition that owns this state in the global StateProvider */
  keyDef: KeyDefinition<unknown>;
  /** Discriminator flag indicating this entry targets GlobalState, not user-scoped state */
  global: true;
}

/** Entry for a preference shared across all device types */
export interface SharedSyncedKeyEntry extends SyncedKeyEntryBase {
  blobField: keyof SharedPreferences;
  scope: typeof SyncScope.Shared;
  device?: never;
}

/** Entry for a per-device preference present in every device type's section (values are unique per device type) */
export interface CommonDeviceSyncedKeyEntry extends SyncedKeyEntryBase {
  blobField: keyof DevicePreferences;
  scope: typeof SyncScope.Device;
  device?: undefined;
}

/** Entry for a per-device preference specific to the browser extension */
export interface BrowserSyncedKeyEntry extends SyncedKeyEntryBase {
  blobField: keyof BrowserPreferences;
  scope: typeof SyncScope.Device;
  device: ClientType.Browser;
}

/** Entry for a shared preference backed by GlobalState (not user-scoped) */
export interface SharedGlobalSyncedKeyEntry extends SyncedGlobalKeyEntryBase {
  blobField: keyof SharedPreferences;
  scope: typeof SyncScope.Shared;
  device?: never;
}

/** Entry for a browser-specific preference backed by GlobalState (not user-scoped) */
export interface BrowserGlobalSyncedKeyEntry extends SyncedGlobalKeyEntryBase {
  blobField: keyof BrowserPreferences;
  scope: typeof SyncScope.Device;
  device: ClientType.Browser;
}

export type GlobalSyncedKeyEntry = SharedGlobalSyncedKeyEntry | BrowserGlobalSyncedKeyEntry;

export type SyncedKeyEntry =
  | SharedSyncedKeyEntry
  | CommonDeviceSyncedKeyEntry
  | BrowserSyncedKeyEntry
  | GlobalSyncedKeyEntry;

/** Type guard to check if a synced key entry targets GlobalState */
export function isGlobalEntry(entry: SyncedKeyEntry): entry is GlobalSyncedKeyEntry {
  return "global" in entry && entry.global === true;
}

// ── Opt-in flag ──

export const PREFERENCE_SYNC_ENABLED = new UserKeyDefinition<boolean>(
  SYNC_SETTINGS_DISK,
  "preferenceSyncEnabled",
  {
    deserializer: (v) => v ?? false,
    clearOn: [],
  },
);

// ── Static registry ──
// Single source of truth for all synced preferences.
// Adding a new synced setting = one entry in this array.
//
// NOTE: Generator settings from @bitwarden/generator (PASSWORD_SETTINGS, etc.)
// and forwarder keys cannot be imported here without creating circular dependencies
// between libs/common and libs/tools. These will be registered separately via
// a registration function called during app bootstrap.

export const SYNCED_KEYS: SyncedKeyEntry[] = [
  // ── Shared (universal, same on all devices) ──

  { keyDef: THEME_SELECTION, blobField: "theme", scope: SyncScope.Shared, global: true },
  { keyDef: LOCALE_KEY, blobField: "locale", scope: SyncScope.Shared, global: true },
  { keyDef: SHOW_FAVICONS, blobField: "showFavicons", scope: SyncScope.Shared, global: true },

  // ── Device — all device types ──

  { keyDef: VAULT_TIMEOUT, blobField: "vaultTimeout", scope: SyncScope.Device },
  { keyDef: VAULT_TIMEOUT_ACTION, blobField: "vaultTimeoutAction", scope: SyncScope.Device },

  // ── Device — browser only ──

  {
    keyDef: AUTOFILL_ON_PAGE_LOAD,
    blobField: "autofillOnPageLoad",
    scope: SyncScope.Device,
    device: ClientType.Browser,
  },
  {
    keyDef: AUTOFILL_ON_PAGE_LOAD_DEFAULT,
    blobField: "autofillOnPageLoadDefault",
    scope: SyncScope.Device,
    device: ClientType.Browser,
  },
  {
    keyDef: AUTO_COPY_TOTP,
    blobField: "autoCopyTotp",
    scope: SyncScope.Device,
    device: ClientType.Browser,
  },
  {
    keyDef: SHOW_INLINE_MENU_IDENTITIES,
    blobField: "showInlineMenuIdentities",
    scope: SyncScope.Device,
    device: ClientType.Browser,
  },
  {
    keyDef: SHOW_INLINE_MENU_CARDS,
    blobField: "showInlineMenuCards",
    scope: SyncScope.Device,
    device: ClientType.Browser,
  },
  {
    keyDef: SHOW_CARDS_CURRENT_TAB,
    blobField: "showCardsCurrentTab",
    scope: SyncScope.Device,
    device: ClientType.Browser,
  },
  {
    keyDef: SHOW_IDENTITIES_CURRENT_TAB,
    blobField: "showIdentitiesCurrentTab",
    scope: SyncScope.Device,
    device: ClientType.Browser,
  },
  {
    keyDef: CLICK_ITEMS_AUTOFILL_VAULT_VIEW,
    blobField: "clickItemsToAutofillOnVaultView",
    scope: SyncScope.Device,
    device: ClientType.Browser,
  },
  {
    keyDef: DEFAULT_URI_MATCH_STRATEGY,
    blobField: "defaultUriMatchStrategy",
    scope: SyncScope.Device,
    device: ClientType.Browser,
  },
  {
    keyDef: ENABLE_BADGE_COUNTER,
    blobField: "enableBadgeCounter",
    scope: SyncScope.Device,
    device: ClientType.Browser,
  },
  {
    keyDef: ROUTING_ANIMATION,
    blobField: "showAnimations",
    scope: SyncScope.Device,
    device: ClientType.Browser,
    global: true,
  },
  {
    keyDef: COMPACT_MODE,
    blobField: "compactMode",
    scope: SyncScope.Device,
    device: ClientType.Browser,
    global: true,
  },
  {
    keyDef: COPY_BUTTON,
    blobField: "copyButtonDisplayMode",
    scope: SyncScope.Device,
    device: ClientType.Browser,
    global: true,
  },
  {
    keyDef: POPUP_WIDTH,
    blobField: "popupWidth",
    scope: SyncScope.Device,
    device: ClientType.Browser,
    global: true,
  },
];

/**
 * Register additional synced keys at runtime.
 * Used by libs/tools to register generator settings and forwarder keys
 * without creating circular dependencies.
 */
export function registerSyncedKeys(entries: SyncedKeyEntry[]): void {
  SYNCED_KEYS.push(...entries);
}
