import { compareValues } from "./compare-values";

describe("compareValues", () => {
  it("should return true for equal primitive values", () => {
    expect(compareValues(1, 1)).toEqual(true);
    expect(compareValues("bitwarden", "bitwarden")).toEqual(true);
    expect(compareValues(true, true)).toEqual(true);
  });

  it("should return false for different primitive values", () => {
    expect(compareValues(1, 2)).toEqual(false);
    expect(compareValues("bitwarden", "bitwarden.com")).toEqual(false);
    expect(compareValues(true, false)).toEqual(false);
  });

  it("should return true when both values are null", () => {
    expect(compareValues(null, null)).toEqual(true);
  });

  it("should compare deeply nested objects correctly", () => {
    // Deeply nested objects
    const obj1 = { a: 1, b: { c: 2, d: { e: 3, f: [4, 5, 6] } }, g: [7, 8, { h: 9 }] };
    const obj2 = { a: 1, b: { c: 2, d: { e: 3, f: [4, 5, 6] } }, g: [7, 8, { h: 9 }] };

    expect(compareValues(obj1, obj2)).toEqual(true);
  });

  it("should return false for deeply nested objects with different values", () => {
    // Deeply nested objects
    const obj1 = { a: 1, b: { c: 2, d: { e: 3, f: [4, 5, 6] } }, g: [7, 8, { h: 9 }] };
    const obj2 = { a: 1, b: { c: 2, d: { e: 3, f: [4, 5, 7] } }, g: [7, 8, { h: 9 }] };

    expect(compareValues(obj1, obj2)).toEqual(false);
  });
});
