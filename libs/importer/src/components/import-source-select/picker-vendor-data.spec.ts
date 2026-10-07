import { importOptions } from "../../models";

import {
  isPickerVendor,
  pickerAlwaysPromptsFormat,
  pickerDisplayNameFor,
  pickerFormatsFor,
} from "./picker-vendor-data";

describe("isPickerVendor", () => {
  it("rejects inherited Object.prototype property names", () => {
    expect(isPickerVendor("constructor")).toBe(false);
    expect(isPickerVendor("toString")).toBe(false);
    expect(isPickerVendor("hasOwnProperty")).toBe(false);
  });
});

describe("pickerDisplayNameFor", () => {
  it("returns a vendor-only name, with no file-type/format suffix, for every card the picker can show", () => {
    // Regression test: several vendors (Universal Password Manager, GNOME,
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

describe("pickerFormatsFor", () => {
  it("returns just the id itself for a single-format vendor", () => {
    expect(pickerFormatsFor("chromecsv")).toEqual(["chromecsv"]);
  });

  it("returns every sibling format for a multi-format vendor", () => {
    expect(pickerFormatsFor("1password1pux")).toEqual([
      "1password1pux",
      "1password1pif",
      "1passwordwincsv",
      "1passwordmaccsv",
    ]);
    expect(pickerFormatsFor("bitwardenjson")).toEqual(["bitwardenjson", "bitwardencsv"]);
    expect(pickerFormatsFor("dashlanecsv")).toEqual(["dashlanecsv", "dashlanejson"]);
    expect(pickerFormatsFor("enpasscsv")).toEqual(["enpasscsv", "enpassjson"]);
    expect(pickerFormatsFor("avastcsv")).toEqual(["avastcsv", "avastjson"]);
    expect(pickerFormatsFor("delineaxml")).toEqual(["delineaxml", "delineacsv"]);
  });

  it("groups KeePass's kdbx and KeePassX's csv siblings under one KeePass card", () => {
    expect(pickerFormatsFor("keepass2xml")).toEqual(["keepass2xml", "keepasskdbx", "keepassxcsv"]);
  });

  it("resolves Keeper's manual-mode formats, not the direct-import pseudo-format", () => {
    // "keeper" itself has no importer (ImportService.getImporter only handles "keepercsv" and
    // "keeperjson") — pickerFormatsFor("keeper") must resolve to those, not to "keeper" itself.
    expect(pickerFormatsFor("keeper")).toEqual(["keepercsv", "keeperjson"]);
  });
});

describe("pickerAlwaysPromptsFormat", () => {
  it("is true for KeePass (whose sibling formats never collide on extension) and 1Password (whose wincsv/maccsv siblings do)", () => {
    expect(pickerAlwaysPromptsFormat("keepass2xml")).toBe(true);
    expect(pickerAlwaysPromptsFormat("1password1pux")).toBe(true);
  });

  it("is false for vendors with no entry, or no flag set", () => {
    expect(pickerAlwaysPromptsFormat("chromecsv")).toBe(false);
    expect(pickerAlwaysPromptsFormat("some-unknown-id")).toBe(false);
  });
});
