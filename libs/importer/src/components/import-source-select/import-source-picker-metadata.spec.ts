import { importOptions } from "../../models";

import {
  isPickerVendor,
  pickerDisplayNameFor,
  pickerIconFor,
} from "./import-source-picker-metadata";

describe("pickerDisplayNameFor", () => {
  it("returns a vendor-only name, with no file-type/format suffix, for every card the picker can show", () => {
    // Regression test: several vendors (Universal Password Manager, GNOME Passwords and Keys,
    // Delinea, etc.) had no entry in the picker's vendor metadata table, so the picker fell back
    // to ImportOption.name verbatim — e.g. "Delinea (xml)" — leaking the file format onto the
    // card. This asserts every visible option's resolved display name is free of that.
    const visibleOptions = importOptions.filter((option) => isPickerVendor(option.id));
    expect(visibleOptions.length).toBeGreaterThan(0);

    const leaked = visibleOptions
      .map((option) => ({
        id: option.id,
        displayName: pickerDisplayNameFor(option.id),
      }))
      .filter(({ displayName }) => /\([^)]*\)/.test(displayName));

    expect(leaked).toEqual([]);
  });
});

describe("pickerIconFor", () => {
  it("returns the dark variant for a vendor that has one, when isDark is true", () => {
    const light = pickerIconFor("1password1pux", false);
    const dark = pickerIconFor("1password1pux", true);

    expect(light).toBeDefined();
    expect(dark).toBeDefined();
    expect(dark).not.toEqual(light);
  });

  it("falls back to the light icon when isDark is true but the vendor has no dark variant", () => {
    // Chrome has an icon but no darkIcon — most vendor marks are full-color and theme-agnostic.
    expect(pickerIconFor("chromecsv", true)).toEqual(pickerIconFor("chromecsv", false));
  });

  it("returns undefined for a vendor with no art at all, regardless of theme", () => {
    expect(pickerIconFor("passworddragonxml", false)).toBeUndefined();
    expect(pickerIconFor("passworddragonxml", true)).toBeUndefined();
  });
});
