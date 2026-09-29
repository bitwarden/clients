import { importOptionsById } from "../models/import-options";

import {
  availableImportSourceGroup,
  importSourceGroup,
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
    expect(importSourceGroupForFormat("onepassword")?.name).toBe("1Password");
    expect(importSourceGroupForFormat("1password1pux")?.name).toBe("1Password");
    expect(importSourceGroupForFormat("1password1pif")?.name).toBe("1Password");
    expect(importSourceGroupForFormat("1passwordmaccsv")?.name).toBe("1Password 6 and 7");
    expect(importSourceGroupForFormat("1passwordwincsv")?.name).toBe("1Password 6 and 7");
    expect(importSourceGroupForFormat("bitwardenjson")).toBeUndefined();
  });

  it("tells group ids apart from formats", () => {
    expect(isImportSourceGroupId("group:1password")).toBe(true);
    expect(isImportSourceGroupId("onepassword")).toBe(false);
    expect(isImportSourceGroupId(null)).toBe(false);
  });

  it("defaults to direct import where the client offers it", () => {
    const group = availableImportSourceGroup(importSourceGroup("group:1password"), () => true);

    expect(group?.methods.map((m) => m.format)).toEqual([
      "onepassword",
      "1password1pux",
      "1password1pif",
    ]);
  });

  it("leaves direct import out where the client does not offer it", () => {
    const group = availableImportSourceGroup(
      importSourceGroup("group:1password"),
      (format) => format !== "onepassword",
    );

    expect(group?.methods[0].format).toBe("1password1pux");
  });

  it("drops a group none of whose methods the client offers", () => {
    expect(
      availableImportSourceGroup(importSourceGroup("group:1password-legacy"), () => false),
    ).toBeUndefined();
  });
});
