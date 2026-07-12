import { pack } from "./pack";

const GAP = 24;

describe("pack", () => {
  describe("not yet measured (containerWidth <= 0)", () => {
    it("returns all indices as displayed", () => {
      const result = pack([100, 100, 100, 100], 0, GAP, null);
      expect(result.displayed).toEqual([0, 1, 2, 3]);
    });

    it("returns empty overflow", () => {
      const result = pack([100, 100, 100, 100], 0, GAP, null);
      expect(result.overflow).toEqual([]);
    });

    it("ignores pinIndex when containerWidth is 0", () => {
      const result = pack([100, 100, 100, 100], 0, GAP, 2);
      expect(result.displayed).toEqual([0, 1, 2, 3]);
      expect(result.overflow).toEqual([]);
    });
  });

  describe("all items fit", () => {
    it("returns all displayed when total <= containerWidth", () => {
      // 100 + (100+24) + (100+24) = 348 <= 500
      const result = pack([100, 100, 100], 500, GAP, null);
      expect(result.displayed).toEqual([0, 1, 2]);
      expect(result.overflow).toEqual([]);
    });

    it("pinIndex is irrelevant when everything fits", () => {
      const a = pack([100, 100, 100], 500, GAP, null);
      const b = pack([100, 100, 100], 500, GAP, 2);
      expect(a).toEqual(b);
    });
  });

  describe("first-fit (no pin)", () => {
    it("packs items left-to-right until one no longer fits", () => {
      // container=200. item 0: 100, used=100. item 1: 100+24=124, 100+124=224 > 200 → overflow.
      const result = pack([100, 100, 100], 200, GAP, null);
      expect(result.displayed).toEqual([0]);
      expect(result.overflow).toEqual([1, 2]);
    });

    it("zero-width items don't trigger overflow", () => {
      const result = pack([100, 0, 0], 200, GAP, null);
      expect(result.displayed).toEqual([0, 1, 2]);
      expect(result.overflow).toEqual([]);
    });
  });

  describe("with pinned item", () => {
    it("keeps the pinned item displayed even when it would otherwise overflow", () => {
      // pin=2 sits past the cutoff but must stay visible.
      const result = pack([100, 100, 100], 200, GAP, 2);
      expect(result.displayed).toContain(2);
      expect(result.overflow).not.toContain(2);
    });

    it("reinserts the pinned item at its ordinal position when it lands at the end", () => {
      // pin=3, all 100px. container=300, gap=24.
      // available = 300 - 100 = 200.
      // i=0: 100, used=100. i=1: 100+24=124, 100+124=224 > 200 → overflow [1,2].
      // Reinsert 3 at end → displayed=[0, 3], overflow=[1, 2].
      const result = pack([100, 100, 100, 100], 300, GAP, 3);
      expect(result.displayed).toEqual([0, 3]);
      expect(result.overflow).toEqual([1, 2]);
    });

    it("reinserts the pinned item at its ordinal position when items follow it", () => {
      // pin=1, four 50px items. container=200, gap=24.
      // available = 200 - 50 = 150.
      // Skip 1, i=0: 50, used=50. i=2: 50+24=74, 50+74=124 <= 150, used=124. i=3: 124+74=198 > 150 → overflow [3].
      // Reinsert 1 ordinal — findIndex(j>1) finds index 1 (value 2). displayed=[0, 1, 2].
      const result = pack([50, 50, 50, 50], 200, GAP, 1);
      expect(result.displayed).toEqual([0, 1, 2]);
      expect(result.overflow).toEqual([3]);
    });

    it("displayed is always in ascending index order", () => {
      const result = pack([50, 50, 50, 50, 50], 200, GAP, 2);
      for (let i = 0; i < result.displayed.length - 1; i++) {
        expect(result.displayed[i]).toBeLessThan(result.displayed[i + 1]);
      }
    });

    it("overflow never contains the pinned index", () => {
      const result = pack([100, 100, 100, 100, 100], 200, GAP, 3);
      expect(result.overflow).not.toContain(3);
    });

    it("keeps the pinned item displayed even when nothing else fits", () => {
      // container=150, pin=0 (200px wide). available = 150 - 200 = -50. Anything > -50 → overflow.
      const result = pack([200, 200], 150, GAP, 0);
      expect(result.displayed).toEqual([0]);
      expect(result.overflow).toEqual([1]);
    });

    it("out-of-range pinIndex falls through to first-fit", () => {
      // pinIndex=10 with only 3 items — treated as no-pin.
      const result = pack([100, 100, 100], 200, GAP, 10);
      // First-fit: item 0 fits (100), item 1 overflows (100+24=124 > 100 remaining).
      expect(result.displayed).toEqual([0]);
      expect(result.overflow).toEqual([1, 2]);
    });
  });
});
