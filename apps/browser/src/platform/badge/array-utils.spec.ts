import { difference } from "./array-utils";

describe("array-utils", () => {
  describe("difference", () => {
    it.each([
      [new Set([1, 2, 3]), new Set([]), new Set([1, 2, 3]), new Set([])],
      [new Set([]), new Set([1, 2, 3]), new Set([]), new Set([1, 2, 3])],
      [new Set([1, 2, 3]), new Set([2, 3, 5]), new Set([1]), new Set([5])],
      [new Set([1, 2, 3]), new Set([1, 2, 3]), new Set([]), new Set([])],
    ])("returns elements that are unique to each set", (A, B, onlyA, onlyB) => {
      const [resultA, resultB] = difference(A, B);

      expect(resultA).toEqual(onlyA);
      expect(resultB).toEqual(onlyB);
    });
  });
});
