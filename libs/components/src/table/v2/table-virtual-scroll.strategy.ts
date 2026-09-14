import { CdkVirtualScrollViewport, VirtualScrollStrategy } from "@angular/cdk/scrolling";
import { Signal } from "@angular/core";
import { Observable, Subject, distinctUntilChanged } from "rxjs";

/** Extra pixels rendered above and below the viewport so scrolling doesn't reveal blank rows. */
const BUFFER_PX = 200;

/**
 * A {@link VirtualScrollStrategy} for items of **known but differing** heights — the
 * table's data rows plus its group-header rows. Unlike CDK's fixed-size strategy
 * (one height for all items), it positions each item from a prefix-sum of the
 * per-item heights, so a single viewport can virtualize an interleaved list of
 * group headers and rows.
 *
 * Heights are read lazily from a signal (pull-based), so every CDK callback sees the
 * current values — there's no window where the strategy holds stale heights. The
 * strategy never measures the DOM, so the rendered height of each item must match
 * the height it was given.
 *
 * `BitTableV2Component` owns the instance and provides it to its viewport via the
 * `VIRTUAL_SCROLL_STRATEGY` token, calling {@link refresh} when heights change.
 */
export class TableVirtualScrollStrategy implements VirtualScrollStrategy {
  private readonly indexChange = new Subject<number>();
  readonly scrolledIndexChange: Observable<number> = this.indexChange.pipe(distinctUntilChanged());

  private viewport: CdkVirtualScrollViewport | null = null;
  /** Cumulative start offsets: `offsets[i]` is the top of item `i`; `offsets[n]` is the total size. */
  private offsets: number[] = [0];
  /** The heights array `offsets` was last built from, so an unchanged pull is a no-op. */
  private builtFrom: readonly number[] | null = null;

  constructor(private readonly itemHeights: Signal<readonly number[]>) {}

  attach(viewport: CdkVirtualScrollViewport): void {
    this.viewport = viewport;
    this.refresh();
  }

  detach(): void {
    // Deliberately does not complete `indexChange`: the owning component reuses this
    // instance, so the viewport may detach and re-attach (the virtualized branch
    // toggling). Completing here would kill `scrolledIndexChange` for good.
    this.viewport = null;
  }

  onContentScrolled(): void {
    this.updateRenderedRange();
  }

  onDataLengthChanged(): void {
    this.refresh();
  }

  onContentRendered(): void {
    /* no-op: heights are supplied, not measured */
  }

  onRenderedOffsetChanged(): void {
    /* no-op */
  }

  scrollToIndex(index: number, behavior: ScrollBehavior): void {
    const clamped = Math.max(0, Math.min(index, this.itemCount));
    this.viewport?.scrollToOffset(this.offsets[clamped], behavior);
  }

  /** Re-reads heights, rebuilds offsets if they changed, and re-renders. */
  refresh(): void {
    this.rebuildOffsets();
    this.viewport?.setTotalContentSize(this.totalSize);
    this.updateRenderedRange();
  }

  private get itemCount(): number {
    return this.offsets.length - 1;
  }

  private get totalSize(): number {
    return this.offsets[this.offsets.length - 1];
  }

  private rebuildOffsets(): void {
    const heights = this.itemHeights();
    if (heights === this.builtFrom) {
      return;
    }
    this.builtFrom = heights;
    this.offsets = new Array(heights.length + 1);
    this.offsets[0] = 0;
    for (let i = 0; i < heights.length; i++) {
      this.offsets[i + 1] = this.offsets[i] + heights[i];
    }
  }

  /** The greatest item index whose top offset is at or before `offset` (clamped to the range). */
  private indexAt(offset: number): number {
    const n = this.itemCount;
    if (n === 0 || offset <= 0) {
      return 0;
    }
    if (offset >= this.totalSize) {
      return n - 1;
    }
    let lo = 0;
    let hi = n - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.offsets[mid] <= offset) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }

  private updateRenderedRange(): void {
    const viewport = this.viewport;
    if (!viewport) {
      return;
    }
    const n = this.itemCount;
    if (n === 0) {
      viewport.setRenderedRange({ start: 0, end: 0 });
      viewport.setRenderedContentOffset(0);
      return;
    }
    const scrollOffset = Math.max(0, viewport.measureScrollOffset());
    const viewportSize = viewport.getViewportSize();
    const start = this.indexAt(scrollOffset - BUFFER_PX);
    const end = Math.min(n, this.indexAt(scrollOffset + viewportSize + BUFFER_PX) + 1);
    viewport.setRenderedRange({ start, end });
    viewport.setRenderedContentOffset(this.offsets[start]);
    this.indexChange.next(this.indexAt(scrollOffset));
  }
}
