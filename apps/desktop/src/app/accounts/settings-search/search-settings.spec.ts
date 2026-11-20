import { SettingsSearchRank, normalizeSettingsSearchText, searchSettings } from "./search-settings";
import {
  SETTINGS_SEARCH_ENTRIES,
  SettingsSearchEntry,
  SettingsSearchEntryId,
} from "./settings-search.registry";

const TRANSLATIONS: Record<string, string> = {
  security: "Security",
  vault: "Vault",
  general: "General",
  integrationsHeader: "Integrations",
  advancedHeader: "Advanced",
  settingsNavAccount: "Account settings",
  settingsNavDevice: "Device settings",

  themeLabel: "Theme",
  themeDesc: "Change the application's color theme.",
  themeKeywords: "Dark mode, light mode",
  appearance: "Appearance",
  languageLabel: "Language",
  languageDesc: "Change the language used by the application.",
  pinLabel: "Unlock with PIN",
  screenshotsLabel: "Allow screenshots",
  screenshotsDesc: "Let other apps capture this window.",
  accentLabel: "Préférence de thème",
};

const translate = (key: string) => TRANSLATIONS[key] ?? key;
const allVisible = () => true;

function entry(
  id: SettingsSearchEntryId,
  page: SettingsSearchEntry["page"],
  labelKey: string,
  extra: Partial<SettingsSearchEntry> = {},
): SettingsSearchEntry {
  return { id, page, labelKey, rowId: `row-${id}`, ...extra };
}

const ENTRIES: SettingsSearchEntry[] = [
  entry("language", "general", "languageLabel", {
    descriptionKey: "languageDesc",
    keywords: ["appearance"],
  }),
  entry("theme", "general", "themeLabel", {
    descriptionKey: "themeDesc",
    keywords: ["appearance", "themeKeywords"],
  }),
  entry("unlockWithPin", "security", "pinLabel"),
  entry("allowScreenshots", "advanced", "screenshotsLabel", { descriptionKey: "screenshotsDesc" }),
];

const ids = (results: { entry: SettingsSearchEntry }[]) => results.map((r) => r.entry.id);

describe("normalizeSettingsSearchText", () => {
  it("lower-cases, strips diacritics, and collapses whitespace", () => {
    expect(normalizeSettingsSearchText("  Préférence   de\tTHÈME ")).toBe("preference de theme");
  });
});

describe("searchSettings", () => {
  it.each(["", "   ", "\t"])("returns nothing for a blank query (%j)", (query) => {
    expect(searchSettings(ENTRIES, query, translate, allVisible)).toEqual([]);
  });

  it("matches case-insensitively", () => {
    expect(ids(searchSettings(ENTRIES, "THEME", translate, allVisible))).toEqual(["theme"]);
  });

  it("matches diacritic-insensitively in both directions", () => {
    const accented = [entry("theme", "general", "accentLabel")];
    expect(ids(searchSettings(accented, "preference", translate, allVisible))).toEqual(["theme"]);
    expect(ids(searchSettings(ENTRIES, "thème", translate, allVisible))).toEqual(["theme"]);
  });

  it("requires every query word to match (AND), across fields", () => {
    expect(ids(searchSettings(ENTRIES, "theme dark", translate, allVisible))).toEqual(["theme"]);
    expect(searchSettings(ENTRIES, "theme nonexistentword", translate, allVisible)).toEqual([]);
  });

  it("matches descriptions, translated keywords, and page names", () => {
    expect(ids(searchSettings(ENTRIES, "capture", translate, allVisible))).toEqual([
      "allowScreenshots",
    ]);
    expect(ids(searchSettings(ENTRIES, "light mode", translate, allVisible))).toEqual(["theme"]);
    expect(ids(searchSettings(ENTRIES, "advanced", translate, allVisible))).toEqual([
      "allowScreenshots",
    ]);
    expect(ids(searchSettings(ENTRIES, "account settings", translate, allVisible))).toEqual([
      "unlockWithPin",
    ]);
  });

  it("ranks label prefix, then label contains, then other matches", () => {
    const results = searchSettings(
      [
        entry("theme", "general", "themeLabel", { descriptionKey: "pinLabel" }),
        entry("unlockWithPin", "security", "pinLabel"),
        entry("language", "general", "pinCodeLabel"),
      ],
      "pin",
      (key) => (key === "pinCodeLabel" ? "PIN code" : translate(key)),
      allVisible,
    );

    expect(ids(results)).toEqual(["language", "unlockWithPin", "theme"]);
    expect(results.map((r) => r.rank)).toEqual([
      SettingsSearchRank.LabelPrefix,
      SettingsSearchRank.LabelContains,
      SettingsSearchRank.Other,
    ]);
  });

  it("only ranks as label contains when every word is in the label", () => {
    const [result] = searchSettings(ENTRIES, "theme dark", translate, allVisible);
    expect(result.rank).toBe(SettingsSearchRank.Other);
  });

  it("keeps registry order for equal ranks (stable)", () => {
    const results = searchSettings(ENTRIES, "change the", translate, allVisible);
    expect(ids(results)).toEqual(["language", "theme"]);
    const reversed = searchSettings([...ENTRIES].reverse(), "change the", translate, allVisible);
    expect(ids(reversed)).toEqual(["theme", "language"]);
  });

  it("excludes entries the host reports as not visible", () => {
    const isVisible = jest.fn((id: SettingsSearchEntryId) => id !== "theme");
    expect(ids(searchSettings(ENTRIES, "appearance", translate, isVisible))).toEqual(["language"]);
    expect(isVisible).toHaveBeenCalledWith("theme");
  });

  it("returns the page and translated label and description", () => {
    const [result] = searchSettings(ENTRIES, "screenshots", translate, allVisible);
    expect(result).toEqual({
      entry: ENTRIES[3],
      page: "advanced",
      rank: SettingsSearchRank.LabelContains,
      label: "Allow screenshots",
      description: "Let other apps capture this window.",
    });
  });

  it("does not translate entries that are not visible", () => {
    const spy = jest.fn(translate);
    searchSettings(ENTRIES, "theme", spy, (id) => id === "theme");
    expect(spy).not.toHaveBeenCalledWith("languageLabel");
  });

  it("works over the real registry with an identity translator", () => {
    const results = searchSettings(
      SETTINGS_SEARCH_ENTRIES,
      "sshagentheader",
      (key) => key,
      allVisible,
    );
    expect(ids(results)).toEqual(["enableSshAgent", "sshAgentPromptBehavior"]);
    expect(results.every((r) => r.page === "integrations")).toBe(true);
  });
});
