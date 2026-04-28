import { computeTabOverflow } from "./tab-utils";

// Note: tab item gap is 24px (TAB_LIST_CONTAINER_GAP). Used in width calculations below.

describe("computeTabOverflow", () => {
  describe("before render (tabListRendered = false)", () => {
    it("returns all indices as displayed", () => {
      const result = computeTabOverflow(4, false, [], 0, 0, 0);
      expect(result.displayed).toEqual([0, 1, 2, 3]);
    });

    it("returns empty overflow array", () => {
      const result = computeTabOverflow(4, false, [], 0, 0, 0);
      expect(result.overflow).toEqual([]);
    });

    it("returns null for truncateTabIndex", () => {
      const result = computeTabOverflow(4, false, [], 0, 0, 0);
      expect(result.truncateTabIndex).toBeNull();
    });
  });

  describe("all tabs fit in container", () => {
    it("returns all indices as displayed, overflow empty", () => {
      // Three 100px tabs: total = 100 + (100+24px) + (100+24px) = 348px <= 500px container
      const result = computeTabOverflow(3, true, [100, 100, 100], 500, 60, 0);
      expect(result.displayed).toEqual([0, 1, 2]);
      expect(result.overflow).toEqual([]);
    });

    it("selectedIndex does not affect result when all tabs fit", () => {
      const result0 = computeTabOverflow(3, true, [100, 100, 100], 500, 60, 0);
      const result2 = computeTabOverflow(3, true, [100, 100, 100], 500, 60, 2);
      expect(result0.displayed).toEqual([0, 1, 2]);
      expect(result2.displayed).toEqual([0, 1, 2]);
      expect(result0.overflow).toEqual([]);
      expect(result2.overflow).toEqual([]);
    });
  });

  describe("some tabs overflow", () => {
    // Setup: three 100px tabs, containerWidth=200, moreButtonWidth=60, selectedIndex=0
    // availableWidth = 200 - 60 - 100 = 40
    // Tab 1 needs 100+24px=124 > 40 → overflows; Tab 2 also overflows

    it("selected tab is always in displayed", () => {
      const result = computeTabOverflow(3, true, [100, 100, 100], 200, 60, 0);
      expect(result.displayed).toContain(0);
    });

    it("non-fitting non-selected tabs go to overflow", () => {
      const result = computeTabOverflow(3, true, [100, 100, 100], 200, 60, 0);
      expect(result.overflow).toContain(1);
      expect(result.overflow).toContain(2);
    });

    it("displayed array preserves original tab order", () => {
      // selectedIndex=2, 50px tabs, container=200, more=60
      // availableWidth = 200 - 60 - 50 = 90
      // Tab 0: 50+24px=74 <= 90 → fits; Tab 1: 74+74=148 > 90 → overflows
      // displayed should be [0, 2] (order preserved)
      const result = computeTabOverflow(4, true, [50, 50, 50, 50], 200, 60, 2);
      const displayed = result.displayed;
      for (let i = 0; i < displayed.length - 1; i++) {
        expect(displayed[i]).toBeLessThan(displayed[i + 1]);
      }
    });

    it("overflow excludes the selected index", () => {
      const result = computeTabOverflow(3, true, [100, 100, 100], 200, 60, 1);
      expect(result.overflow).not.toContain(1);
    });
  });

  describe("truncateTabIndex", () => {
    it("is null when there is no overflow", () => {
      const result = computeTabOverflow(3, true, [100, 100, 100], 500, 60, 0);
      expect(result.truncateTabIndex).toBeNull();
    });

    it("is selectedIndex when only the selected tab is displayed, overflow exists, and availableWidth < 0", () => {
      // Two 200px tabs, container=150, more=60, selected=0
      // availableWidth = 150 - 60 - 200 = -110 < 0
      // Tab 1 (200+24px=224) > -110 → overflows
      // displayed=[0], overflow=[1], availableWidth<0 → truncate selected
      const result = computeTabOverflow(2, true, [200, 200], 150, 60, 0);
      expect(result.truncateTabIndex).toBe(0);
    });

    it("is null when multiple tabs are displayed even if availableWidth < 0", () => {
      // Two tabs where both fit but only barely — truncation only fires when displayed.length===1
      const result = computeTabOverflow(3, true, [100, 100, 100], 500, 60, 0);
      expect(result.truncateTabIndex).toBeNull();
    });
  });
});
