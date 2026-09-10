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

  it("returns an empty array for anything that isn't an array", () => {
    // A chip's value is never a bare scalar, so there is nothing to unwrap.
    expect(selectedFilterStrings("a")).toEqual([]);
    expect(selectedFilterStrings(undefined)).toEqual([]);
    expect(selectedFilterStrings(null)).toEqual([]);
  });
});
