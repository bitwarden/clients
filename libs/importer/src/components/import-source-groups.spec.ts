import { importOptionsById } from "../models/import-options";

import {
  importSourceGroupForFormat,
  importSourceGroups,
  isImportSourceGroupId,
} from "./import-source-groups";

describe("import source groups", () => {
  it("only groups formats the importer knows", () => {
    const formats = importSourceGroups.flatMap((group) => group.methods.map((m) => m.format));

    expect(formats.filter((format) => !(format in importOptionsById))).toEqual([]);
    expect(new Set(formats).size).toBe(formats.length);
  });

  it("offers every 1Password format under one of the two 1Password sources", () => {
    expect(importSourceGroupForFormat("1password1pux")?.name).toBe("1Password");
    expect(importSourceGroupForFormat("1password1pif")?.name).toBe("1Password");
    expect(importSourceGroupForFormat("1passwordmaccsv")?.name).toBe("1Password 6 and 7");
    expect(importSourceGroupForFormat("1passwordwincsv")?.name).toBe("1Password 6 and 7");
    expect(importSourceGroupForFormat("bitwardenjson")).toBeUndefined();
  });

  it("tells group ids apart from formats", () => {
    expect(isImportSourceGroupId("group:1password")).toBe(true);
    expect(isImportSourceGroupId("1password1pux")).toBe(false);
    expect(isImportSourceGroupId(null)).toBe(false);
  });
});
