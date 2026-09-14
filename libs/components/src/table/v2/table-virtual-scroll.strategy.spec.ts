import { CdkVirtualScrollViewport } from "@angular/cdk/scrolling";
import { WritableSignal, signal } from "@angular/core";

import { TableVirtualScrollStrategy } from "./table-virtual-scroll.strategy";

/** Records the viewport calls the strategy makes and feeds it a scroll offset / size. */
class FakeViewport {
  scrollOffset = 0;
  viewportSize = 0;

  totalContentSize?: number;
  renderedRange?: { start: number; end: number };
  contentOffset?: number;
  scrolledTo?: number;

  measureScrollOffset(): number {
    return this.scrollOffset;
  }
  getViewportSize(): number {
    return this.viewportSize;
  }
  setTotalContentSize(size: number): void {
    this.totalContentSize = size;
  }
  setRenderedRange(range: { start: number; end: number }): void {
    this.renderedRange = range;
  }
  setRenderedContentOffset(offset: number): void {
    this.contentOffset = offset;
  }
  scrollToOffset(offset: number): void {
    this.scrolledTo = offset;
  }

  asViewport(): CdkVirtualScrollViewport {
    return this as unknown as CdkVirtualScrollViewport;
  }
}

describe("TableVirtualScrollStrategy", () => {
  let heights: WritableSignal<readonly number[]>;
  let strategy: TableVirtualScrollStrategy;
  let viewport: FakeViewport;

  const attach = (viewportSize: number, scrollOffset = 0) => {
    viewport.viewportSize = viewportSize;
    viewport.scrollOffset = scrollOffset;
    strategy.attach(viewport.asViewport());
  };

  beforeEach(() => {
    heights = signal<readonly number[]>([]);
    strategy = new TableVirtualScrollStrategy(heights);
    viewport = new FakeViewport();
  });

  it("sets total content size to the sum of the item heights", () => {
    heights.set([100, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
    attach(300);

    expect(viewport.totalContentSize).toBe(1000);
  });

  it("renders from the top with a trailing buffer", () => {
    heights.set(Array(10).fill(100));
    attach(300);

    // viewport 300 + 200 buffer reaches offset 500 (item index 5), so end is 6.
    expect(viewport.renderedRange).toEqual({ start: 0, end: 6 });
    expect(viewport.contentOffset).toBe(0);
  });

  it("renders a buffered window when scrolled and offsets content to the first item", () => {
    heights.set(Array(10).fill(100));
    attach(300, 400);
    strategy.onContentScrolled();

    // start = item at (400 - 200) = 200 → index 2; end = item at (400 + 300 + 200) = 900 → 9, +1.
    expect(viewport.renderedRange).toEqual({ start: 2, end: 10 });
    expect(viewport.contentOffset).toBe(200);
  });

  it("positions variable-height items from their prefix-sum offset", () => {
    // A group header (40) then rows (100), etc.
    heights.set([40, 100, 100, 40, 100]);
    attach(1000);

    expect(viewport.totalContentSize).toBe(380);

    strategy.scrollToIndex(3, "auto");
    expect(viewport.scrolledTo).toBe(240); // 40 + 100 + 100
  });

  it("handles an empty list", () => {
    heights.set([]);
    attach(300);

    expect(viewport.totalContentSize).toBe(0);
    expect(viewport.renderedRange).toEqual({ start: 0, end: 0 });
    expect(viewport.contentOffset).toBe(0);
  });

  it("re-reads heights on refresh (e.g. a group collapses)", () => {
    heights.set([100, 100, 100]);
    attach(300);
    expect(viewport.totalContentSize).toBe(300);

    heights.set([100, 100]);
    strategy.onDataLengthChanged();

    expect(viewport.totalContentSize).toBe(200);
    expect(viewport.renderedRange).toEqual({ start: 0, end: 2 });
  });

  it("emits the first visible index and keeps emitting after a detach/re-attach", () => {
    heights.set(Array(10).fill(100));
    const emitted: number[] = [];
    strategy.scrolledIndexChange.subscribe((i) => emitted.push(i));

    attach(300, 0); // first visible index 0
    viewport.scrollOffset = 250;
    strategy.onContentScrolled(); // first visible index 2

    strategy.detach();
    attach(300, 0); // re-attach still emits (subject not completed on detach)

    expect(emitted).toEqual([0, 2, 0]);
  });
});
