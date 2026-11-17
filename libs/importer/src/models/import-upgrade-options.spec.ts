import { importOptions, importOptionsById } from "./import-options";
import { importUpgradeOptions, importUpgradeOptionsById } from "./import-upgrade-options";

const VENDOR_ONLY_IDS = [
  "bitwarden",
  "dashlane",
  "keepass",
  "1password",
  "enpass",
  "avast",
  "delinea",
] as const;

describe("importUpgradeOptions", () => {
  it("adds the picker vendor entries without touching the shared options table", () => {
    for (const id of VENDOR_ONLY_IDS) {
      expect(importUpgradeOptions.some((option) => option.id === id)).toBe(true);
      expect(importOptions.some((option) => option.id === id)).toBe(false);
    }
  });

  it("carries every shared option too", () => {
    for (const option of importOptions) {
      expect(importUpgradeOptions.some((candidate) => candidate.id === option.id)).toBe(true);
    }
  });

  it("pairs instructionLink and sourceName — never one without the other", () => {
    for (const option of importUpgradeOptions) {
      expect(!!option.instructionLink).toEqual(!!option.sourceName);
    }
  });

  it("points the KeePass formats at the Help Center article instead of the legacy instruction text", () => {
    for (const id of ["keepass2xml", "keepassxcsv"] as const) {
      expect(importUpgradeOptionsById[id].instructionLink).toBe(
        "https://bitwarden.com/help/import-from-keepass/",
      );
      expect("instructionKey" in importUpgradeOptionsById[id]).toBe(false);
    }
  });

  it("leaves the shared KeePass formats on their legacy instruction text", () => {
    expect(importOptionsById.keepass2xml.instructionKey).toBe("importKeepass2Instructions");
    expect(importOptionsById.keepassxcsv.instructionKey).toBe("importKeepassxInstructions");
    expect("instructionLink" in importOptionsById.keepass2xml).toBe(false);
  });

  it("renames the two 1Password legacy csv formats only in the upgrade table", () => {
    expect(importUpgradeOptionsById["1passwordwincsv"].name).toBe("1Password 6 and 7 Windows .csv");
    expect(importUpgradeOptionsById["1passwordmaccsv"].name).toBe("1Password 6 and 7 Mac .csv");
    expect(importOptionsById["1passwordwincsv"].name).toBe("1Password 6 and 7 Windows (csv)");
    expect(importOptionsById["1passwordmaccsv"].name).toBe("1Password 6 and 7 Mac (csv)");
  });
});
