import { resolveCollectionNames } from "./collection-names";

const collections = [
  { id: "col-1", name: "Engineering" },
  { id: "col-2", name: "Ardvark" },
];

describe("resolveCollectionNames", () => {
  it("resolves ids to names", () => {
    expect(resolveCollectionNames(["col-1"], collections)).toEqual(["Engineering"]);
  });

  it("sorts the resolved names alphabetically", () => {
    expect(resolveCollectionNames(["col-1", "col-2"], collections)).toEqual([
      "Ardvark",
      "Engineering",
    ]);
  });

  it("falls back to the raw id when no collection matches", () => {
    expect(resolveCollectionNames(["col-1", "missing"], collections)).toEqual([
      "Engineering",
      "missing",
    ]);
  });

  it("returns an empty array when the rule targets no collections", () => {
    expect(resolveCollectionNames([], collections)).toEqual([]);
  });
});
