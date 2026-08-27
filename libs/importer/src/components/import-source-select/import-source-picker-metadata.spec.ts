import { importOptions } from "../../models";

import { isPickerVendor, pickerDisplayNameFor } from "./import-source-picker-metadata";

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
