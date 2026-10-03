import { pickerIconFor } from "./import-source-picker-metadata";

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
