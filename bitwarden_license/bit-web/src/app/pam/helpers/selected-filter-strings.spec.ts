import { selectedFilterStrings } from "./selected-filter-strings";

describe("selectedFilterStrings", () => {
  it("returns a string array unchanged", () => {
    expect(selectedFilterStrings(["a", "b"])).toEqual(["a", "b"]);
  });

  it("drops non-string members of the array", () => {
    expect(selectedFilterStrings(["a", 1, null, "b", undefined])).toEqual(["a", "b"]);
  });

  it("returns an empty array for an empty array", () => {
    expect(selectedFilterStrings([])).toEqual([]);
  });

  it("returns an empty array for a single string, since a chip's value is never a bare scalar", () => {
    expect(selectedFilterStrings("a")).toEqual([]);
  });

  it("returns an empty array for undefined", () => {
    expect(selectedFilterStrings(undefined)).toEqual([]);
  });

  it("returns an empty array for null", () => {
    expect(selectedFilterStrings(null)).toEqual([]);
  });
});
