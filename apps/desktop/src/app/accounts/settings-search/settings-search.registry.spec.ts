import { readFileSync } from "fs";
import { join } from "path";

import {
  SETTINGS_SEARCH_ENTRIES,
  SETTINGS_SEARCH_ENTRY_IDS,
  SETTINGS_SEARCH_PAGES,
  settingsSearchRowId,
  withSettingsSearchOverrides,
} from "./settings-search.registry";

// New copy introduced with settings search. Remove a key from this set once it is in messages.json.
const PENDING_I18N_KEYS = new Set([
  "settingsSearchKeywordsTimeoutVfo1",
  "settingsSearchKeywordsBiometricsVfo1",
  "settingsSearchKeywordsThemeVfo1",
  "settingsSearchKeywordsAutotypeVfo1",
  "settingsSearchKeywordsScreenshotsVfo1",
  "settingsSearchKeywordsHardwareAccelerationVfo1",
]);

const messages: Record<string, unknown> = JSON.parse(
  readFileSync(join(__dirname, "../../../locales/en/messages.json"), "utf8"),
);

describe("settings search registry", () => {
  it("has one entry per id, in id order", () => {
    expect(SETTINGS_SEARCH_ENTRIES.map((e) => e.id)).toEqual([...SETTINGS_SEARCH_ENTRY_IDS]);
    expect(new Set(SETTINGS_SEARCH_ENTRY_IDS).size).toBe(SETTINGS_SEARCH_ENTRY_IDS.length);
  });

  it("gives every entry a unique row id derived from its id", () => {
    for (const entry of SETTINGS_SEARCH_ENTRIES) {
      expect(entry.rowId).toBe(settingsSearchRowId(entry.id));
    }
    expect(new Set(SETTINGS_SEARCH_ENTRIES.map((e) => e.rowId)).size).toBe(
      SETTINGS_SEARCH_ENTRIES.length,
    );
  });

  it("covers every page", () => {
    const pages = new Set(SETTINGS_SEARCH_ENTRIES.map((e) => e.page));
    expect([...pages].sort()).toEqual(Object.keys(SETTINGS_SEARCH_PAGES).sort());
  });

  it("puts the SSH agent settings on the integrations page", () => {
    const ssh = SETTINGS_SEARCH_ENTRIES.filter((e) => e.id.toLowerCase().includes("ssh"));
    expect(ssh.map((e) => e.id)).toEqual(["enableSshAgent", "sshAgentPromptBehavior"]);
    expect(ssh.every((e) => e.page === "integrations")).toBe(true);
  });

  it("only references i18n keys that exist in the desktop en messages", () => {
    const keys = new Set<string>();
    for (const entry of SETTINGS_SEARCH_ENTRIES) {
      keys.add(entry.labelKey);
      if (entry.descriptionKey) {
        keys.add(entry.descriptionKey);
      }
      entry.keywords?.forEach((k) => keys.add(k));
    }
    for (const page of Object.values(SETTINGS_SEARCH_PAGES)) {
      keys.add(page.labelKey);
      keys.add(page.scopeLabelKey);
    }

    const missing = [...keys].filter((k) => !(k in messages) && !PENDING_I18N_KEYS.has(k));
    expect(missing).toEqual([]);
  });

  describe("withSettingsSearchOverrides", () => {
    it("replaces keys only on the overridden entries without mutating the input", () => {
      const result = withSettingsSearchOverrides(SETTINGS_SEARCH_ENTRIES, {
        unlockWithBiometrics: { labelKey: "unlockWithTouchId" },
      });

      expect(result.find((e) => e.id === "unlockWithBiometrics")?.labelKey).toBe(
        "unlockWithTouchId",
      );
      expect(SETTINGS_SEARCH_ENTRIES.find((e) => e.id === "unlockWithBiometrics")?.labelKey).toBe(
        "unlockWithBiometrics",
      );
      expect(result.find((e) => e.id === "theme")).toBe(
        SETTINGS_SEARCH_ENTRIES.find((e) => e.id === "theme"),
      );
    });
  });
});
