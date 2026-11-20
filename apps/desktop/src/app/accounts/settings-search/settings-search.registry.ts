/** Pages of the desktop Settings view, matching the `page()` signal in `SettingsComponent`. */
export type SettingsSearchPage = "security" | "vault" | "general" | "integrations" | "advanced";

export interface SettingsSearchPageInfo {
  /** i18n key of the page name shown in the Settings nav. */
  readonly labelKey: string;
  /** i18n key of the nav group the page belongs to (e.g. "Account settings"). */
  readonly scopeLabelKey: string;
}

export const SETTINGS_SEARCH_PAGES: Readonly<Record<SettingsSearchPage, SettingsSearchPageInfo>> = {
  security: { labelKey: "security", scopeLabelKey: "settingsNavAccount" },
  vault: { labelKey: "vault", scopeLabelKey: "settingsNavAccount" },
  general: { labelKey: "general", scopeLabelKey: "settingsNavDevice" },
  integrations: { labelKey: "integrationsHeader", scopeLabelKey: "settingsNavDevice" },
  advanced: { labelKey: "advancedHeader", scopeLabelKey: "settingsNavDevice" },
};

/** Every searchable setting row, in page and template order (this order is the tiebreak order of results). */
export const SETTINGS_SEARCH_ENTRY_IDS = Object.freeze([
  "sessionTimeout",
  "unlockWithPin",
  "unlockWithBiometrics",
  "requireMasterPasswordOnAppRestart",
  "autoPromptBiometrics",
  "syncVault",
  "clearClipboard",
  "minimizeOnCopyToClipboard",
  "theme",
  "language",
  "showFavicons",
  "showQuickCopyActions",
  "runInBackground",
  "openAtLogin",
  "enableSshAgent",
  "sshAgentPromptBehavior",
  "duckDuckGoBrowserIntegration",
  "passkeyProvider",
  "autotype",
  "autotypeGa",
  "allowScreenshots",
  "hardwareAcceleration",
] as const);

export type SettingsSearchEntryId = (typeof SETTINGS_SEARCH_ENTRY_IDS)[number];

export interface SettingsSearchEntry {
  readonly id: SettingsSearchEntryId;
  readonly page: SettingsSearchPage;
  /** i18n key of the row's visible label. */
  readonly labelKey: string;
  /** i18n key of the row's visible description, if any. */
  readonly descriptionKey?: string;
  /** i18n keys of extra searchable text: the card header, alternate labels, and localized synonyms. */
  readonly keywords?: readonly string[];
  /** DOM id of the row element in the Settings template, used to scroll to and focus the row. */
  readonly rowId: string;
}

/**
 * Decides whether a setting row is currently rendered. Supplied by the host, which owns the
 * platform and state conditionals; the registry never hard-codes visibility.
 */
export type SettingsSearchVisibility = (entryId: SettingsSearchEntryId) => boolean;

/** Resolves an i18n key to display text. */
export type SettingsSearchTranslate = (key: string) => string;

type EntryDefinition = Omit<SettingsSearchEntry, "id" | "rowId">;

/** Keyed by id so the compiler enforces exactly one definition per `SettingsSearchEntryId`. */
const DEFINITIONS: Readonly<Record<SettingsSearchEntryId, EntryDefinition>> = {
  sessionTimeout: {
    page: "security",
    labelKey: "sessionTimeoutHeader",
    keywords: [
      "vaultTimeout",
      "vaultTimeout1",
      "sessionTimeoutSettingsAction",
      "settingsSearchKeywordsTimeoutVfo1",
    ],
  },
  unlockWithPin: {
    page: "security",
    labelKey: "unlockWithPin",
    keywords: ["unlockMethodsHeader"],
  },
  unlockWithBiometrics: {
    page: "security",
    labelKey: "unlockWithBiometrics",
    keywords: [
      "unlockMethodsHeader",
      "unlockWithTouchId",
      "unlockWithWindowsHello",
      "unlockWithPolkit",
      "settingsSearchKeywordsBiometricsVfo1",
    ],
  },
  requireMasterPasswordOnAppRestart: {
    page: "security",
    labelKey: "requireMasterPasswordOnAppRestart",
    descriptionKey: "requireMasterPasswordOnAppRestartDescVfo1",
    keywords: ["unlockMethodsHeader", "requireMasterPasswordOrPinOnAppRestart"],
  },
  autoPromptBiometrics: {
    page: "security",
    labelKey: "autoPromptTouchId",
    keywords: ["unlockMethodsHeader", "settingsSearchKeywordsBiometricsVfo1"],
  },
  syncVault: {
    page: "vault",
    labelKey: "syncVaultHeading",
    keywords: ["syncHeader", "syncNow", "lastSyncLabel"],
  },
  clearClipboard: {
    page: "vault",
    labelKey: "clearClipboard",
    descriptionKey: "clearClipboardDesc",
    keywords: ["clipboardHeader"],
  },
  minimizeOnCopyToClipboard: {
    page: "vault",
    labelKey: "minimizeOnCopyToClipboard",
    descriptionKey: "minimizeOnCopyToClipboardDesc",
    keywords: ["clipboardHeader"],
  },
  theme: {
    page: "general",
    labelKey: "theme",
    descriptionKey: "themeDesc",
    keywords: ["appearanceHeader", "settingsSearchKeywordsThemeVfo1"],
  },
  language: {
    page: "general",
    labelKey: "language",
    descriptionKey: "languageDesc",
    keywords: ["appearanceHeader"],
  },
  showFavicons: {
    page: "general",
    labelKey: "showIconsChangePasswordUrls",
    keywords: ["vaultDisplayHeader"],
  },
  showQuickCopyActions: {
    page: "general",
    labelKey: "showQuickCopyActionsInVault",
    keywords: ["vaultDisplayHeader"],
  },
  runInBackground: {
    page: "general",
    labelKey: "runInBackground",
    descriptionKey: "runInBackgroundDesc",
    keywords: ["startupHeader", "runInBackgroundDescMac"],
  },
  openAtLogin: {
    page: "general",
    labelKey: "openAtLogin",
    descriptionKey: "openAtLoginDesc",
    keywords: ["startupHeader"],
  },
  enableSshAgent: {
    page: "integrations",
    labelKey: "enableSshAgent",
    descriptionKey: "enableSshAgentDesc",
    keywords: ["sshAgentHeader"],
  },
  sshAgentPromptBehavior: {
    page: "integrations",
    labelKey: "sshAgentPromptBehavior",
    descriptionKey: "sshAgentPromptBehaviorDesc",
    keywords: ["sshAgentHeader"],
  },
  duckDuckGoBrowserIntegration: {
    page: "integrations",
    labelKey: "enableDuckDuckGoBrowserIntegration",
    descriptionKey: "enableDuckDuckGoBrowserIntegrationDesc",
    keywords: ["browsersHeader"],
  },
  passkeyProvider: {
    page: "integrations",
    labelKey: "passkeyProvider",
    descriptionKey: "passkeyProviderDesc",
    keywords: ["passkeysHeader", "manageInSystemSettings"],
  },
  autotype: {
    page: "integrations",
    labelKey: "enableAutotypeShortcutPreviewVfo1",
    keywords: [
      "autotypeHeader",
      "enableAutotypeShortcutDescription",
      "settingsSearchKeywordsAutotypeVfo1",
    ],
  },
  autotypeGa: {
    page: "integrations",
    labelKey: "enableAutotypeGaShortcut",
    keywords: [
      "autotypeHeader",
      "enableAutotypeShortcutDescription",
      "settingsSearchKeywordsAutotypeVfo1",
    ],
  },
  allowScreenshots: {
    page: "advanced",
    labelKey: "allowScreenshots",
    descriptionKey: "allowScreenshotsDescVfo1",
    keywords: ["privacyHeader", "settingsSearchKeywordsScreenshotsVfo1"],
  },
  hardwareAcceleration: {
    page: "advanced",
    labelKey: "enableHardwareAcceleration",
    descriptionKey: "enableHardwareAccelerationDescVfo1",
    keywords: ["performanceHeader", "settingsSearchKeywordsHardwareAccelerationVfo1"],
  },
};

/** DOM id the host template must put on the row element for `entryId`. */
export function settingsSearchRowId(entryId: SettingsSearchEntryId): string {
  return `settings-row-${entryId}`;
}

/** Every setting row in the desktop Settings view, in page and template order. */
export const SETTINGS_SEARCH_ENTRIES: readonly SettingsSearchEntry[] =
  SETTINGS_SEARCH_ENTRY_IDS.map((id) => ({
    id,
    rowId: settingsSearchRowId(id),
    ...DEFINITIONS[id],
  }));

/**
 * Returns `entries` with the given label/description keys swapped in, for rows whose visible copy
 * depends on platform or state (e.g. "Unlock with Touch ID" on macOS).
 */
export function withSettingsSearchOverrides(
  entries: readonly SettingsSearchEntry[],
  overrides: Partial<
    Record<SettingsSearchEntryId, Partial<Pick<SettingsSearchEntry, "labelKey" | "descriptionKey">>>
  >,
): SettingsSearchEntry[] {
  return entries.map((entry) => {
    const override = overrides[entry.id];
    return override ? { ...entry, ...override } : entry;
  });
}
