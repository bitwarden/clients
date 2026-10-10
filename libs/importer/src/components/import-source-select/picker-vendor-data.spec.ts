import { importOptions, VENDOR_ONLY_IMPORT_TYPE_IDS } from "../../models";

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
    expect(pickerFormatsFor("1password")).toEqual([
      "1password1pux",
      "1password1pif",
      "1passwordmaccsv",
      "1passwordwincsv",
    ]);
    expect(pickerFormatsFor("bitwarden")).toEqual(["bitwardenjson", "bitwardencsv"]);
    expect(pickerFormatsFor("dashlane")).toEqual(["dashlanecsv", "dashlanejson"]);
    expect(pickerFormatsFor("enpass")).toEqual(["enpasscsv", "enpassjson"]);
    expect(pickerFormatsFor("avast")).toEqual(["avastcsv", "avastjson"]);
    expect(pickerFormatsFor("delinea")).toEqual(["delineaxml", "delineacsv"]);
  });

  it("groups KeePass's kdbx and KeePassX's csv siblings under one KeePass card", () => {
    expect(pickerFormatsFor("keepass")).toEqual(["keepasskdbx", "keepass2xml", "keepassxcsv"]);
  });

  it("resolves Keeper's manual-mode formats, not the direct-import pseudo-format", () => {
    // "keeper" itself has no importer (ImportService.getImporter only handles "keepercsv" and
    // "keeperjson") — pickerFormatsFor("keeper") must resolve to those, not to "keeper" itself.
    expect(pickerFormatsFor("keeper")).toEqual(["keepercsv", "keeperjson"]);
  });
});

describe("pickerAlwaysPromptsFormat", () => {
  it("is true for KeePass (whose sibling formats never collide on extension) and 1Password (whose wincsv/maccsv siblings do)", () => {
    expect(pickerAlwaysPromptsFormat("keepass")).toBe(true);
    expect(pickerAlwaysPromptsFormat("1password")).toBe(true);
  });

  it("is false for vendors with no entry, or no flag set", () => {
    expect(pickerAlwaysPromptsFormat("chromecsv")).toBe(false);
    expect(pickerAlwaysPromptsFormat("some-unknown-id")).toBe(false);
  });
});

describe("picker vendors that group several formats", () => {
  const entryFor = (id: string) => importOptions.find((option) => option.id === id);
  const union = (lists: readonly (readonly string[])[]) => Array.from(new Set(lists.flat()));
  const vendorIds = Array.from(VENDOR_ONLY_IMPORT_TYPE_IDS);

  it("are exactly the vendor-only ids, apart from keeper whose id is already its own entry", () => {
    const grouped = importOptions
      .filter((option) => isPickerVendor(option.id) && pickerFormatsFor(option.id).length > 1)
      .map((option) => option.id)
      .filter((id) => id !== "keeper");

    expect(grouped.sort()).toEqual([...vendorIds].sort());
  });

  it.each(vendorIds)("%s lists only formats that exist and are not vendor-only", (id) => {
    const formats = pickerFormatsFor(id);

    expect(formats.length).toBeGreaterThan(1);
    for (const format of formats) {
      expect(entryFor(format)).toBeDefined();
      expect(VENDOR_ONLY_IMPORT_TYPE_IDS.has(format)).toBe(false);
    }
  });

  it.each(vendorIds)("%s's entry carries the union of its formats' file types", (id) => {
    const formats = pickerFormatsFor(id).map((format) => entryFor(format)!);

    expect(entryFor(id)!.acceptedFileTypes).toEqual(union(formats.map((f) => f.acceptedFileTypes)));
    expect(entryFor(id)!.pasteFormats).toEqual(union(formats.map((f) => f.pasteFormats)));
  });
});
