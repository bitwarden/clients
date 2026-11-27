import { composeFolderName, parseFolderName } from "./folder-utils";

describe("parseFolderName", () => {
  it("returns a top-level name with no parent", () => {
    expect(parseFolderName("Family")).toEqual({ name: "Family" });
  });

  it("splits a nested name at the last delimiter", () => {
    expect(parseFolderName("Family/Home/Utilities")).toEqual({
      name: "Utilities",
      parent: "Family/Home",
    });
  });

  it("ignores leading and trailing delimiters", () => {
    expect(parseFolderName("/Family/House/")).toEqual({ name: "House", parent: "Family" });
  });

  it("handles an empty name", () => {
    expect(parseFolderName("")).toEqual({ name: "" });
  });
});

describe("composeFolderName", () => {
  it("returns the name alone when there is no parent", () => {
    expect(composeFolderName(undefined, "Family")).toBe("Family");
    expect(composeFolderName(null, "Family")).toBe("Family");
    expect(composeFolderName("", "Family")).toBe("Family");
  });

  it("joins the name onto the parent path", () => {
    expect(composeFolderName("Family/Home", "Utilities")).toBe("Family/Home/Utilities");
  });

  it("round-trips with parseFolderName", () => {
    const { name, parent } = parseFolderName("Family/House");

    expect(composeFolderName(parent, name)).toBe("Family/House");
  });
});
