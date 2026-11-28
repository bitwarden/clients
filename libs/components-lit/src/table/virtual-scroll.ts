import { ReactiveController, ReactiveControllerHost } from "lit";

/** Extra pixels rendered above and below the viewport so scrolling doesn't reveal blank rows. */
const BUFFER_PX = 200;

/** Rows rendered before the first measurement. */
const INITIAL_COUNT = 30;

export type VirtualRange = { start: number; end: number };

/** The nearest scrolling ancestor in the flat tree (crossing shadow roots and slots), or `null` for the window. */
export function findScrollParent(el: Element): HTMLElement | null {
  let node: Node | null = el;
  while (node) {
    const next: Node | null =
      (node as Element).assignedSlot ??
      node.parentNode ??
      (node instanceof ShadowRoot ? node.host : null);
    node = next instanceof ShadowRoot ? next.host : next;
    if (node instanceof HTMLElement) {
      if (node === document.body || node === document.documentElement) {
        return null;
      }
      const overflowY = getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
        return node;
      }
    }
  }
  return null;
}

/**
 * Positions items of known (possibly differing) heights from a prefix sum of those heights, so
 * interleaved group headers and rows can share one virtualized list. Never measures items: each
 * must render at exactly the height it was given.
 */
export class ItemOffsets {
  /** `offsets[i]` is the top of item `i`; `offsets[n]` is the total size. */
  readonly offsets: number[];

  constructor(heights: readonly number[]) {
    this.offsets = new Array(heights.length + 1);
    this.offsets[0] = 0;
    for (let i = 0; i < heights.length; i++) {
      this.offsets[i + 1] = this.offsets[i] + heights[i];
    }
  }

  get count(): number {
    return this.offsets.length - 1;
  }

  get total(): number {
    return this.offsets[this.offsets.length - 1];
  }

  /** The greatest item index whose top offset is at or before `offset` (clamped to the range). */
  indexAt(offset: number): number {
    const n = this.count;
    if (n === 0 || offset <= 0) {
      return 0;
    }
    if (offset >= this.total) {
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

  /** The items intersecting `[scrollOffset, scrollOffset + viewportSize]`, plus a buffer. */
  range(scrollOffset: number, viewportSize: number): VirtualRange {
    const n = this.count;
    if (n === 0) {
      return { start: 0, end: 0 };
    }
    const start = this.indexAt(scrollOffset - BUFFER_PX);
    const end = Math.min(n, this.indexAt(scrollOffset + viewportSize + BUFFER_PX) + 1);
    return { start, end };
  }
}

export type VirtualScrollOptions = {
  /** Height of each item, in render order. */
  heights: () => readonly number[];
  /** The element whose top is offset 0 of the list (e.g. a `tbody`). */
  content: () => HTMLElement | null | undefined;
  /** The scroll container. Defaults to the nearest scrolling ancestor of `content`, else the window. */
  scroller?: () => HTMLElement | null | undefined;
};

/**
 * Computes which items of a fixed-height list are on screen and re-renders the host when that
 * changes. Replaces the CDK virtual scroll viewport. Works against the element's own scroll box or
 * any scrolling ancestor (e.g. the page), and re-measures when either resizes.
 */
export class VirtualScrollController implements ReactiveController {
  range: VirtualRange = { start: 0, end: 0 };
  offsets = new ItemOffsets([]);

  private scrollTarget: HTMLElement | Window | null = null;
  private readonly resizeObserver = new ResizeObserver(() => this.measure());
  private observed = new Set<Element>();
  private builtFrom: readonly number[] | null = null;
  private measured = false;

  constructor(
    private readonly host: ReactiveControllerHost & HTMLElement,
    private readonly options: VirtualScrollOptions,
  ) {
    host.addController(this);
  }

  hostConnected() {
    this.measured = false;
  }

  hostDisconnected() {
    this.detach();
  }

  /** Call from `willUpdate` so the render sees offsets for the current items. */
  prepare() {
    const heights = this.options.heights();
    if (heights !== this.builtFrom) {
      this.builtFrom = heights;
      this.offsets = new ItemOffsets(heights);
    }
    const n = this.offsets.count;
    if (!this.measured) {
      this.range = { start: 0, end: Math.min(n, INITIAL_COUNT) };
    } else if (this.range.end > n || this.range.end - this.range.start === 0) {
      this.range = this.compute();
    }
  }

  hostUpdated() {
    const content = this.options.content();
    if (!content) {
      this.detach();
      return;
    }
    const scroller = this.options.scroller?.() ?? findScrollParent(content);
    const target = scroller ?? window;
    if (target !== this.scrollTarget) {
      this.detach();
      this.scrollTarget = target;
      target.addEventListener("scroll", this.onScroll, { passive: true });
      if (target === window) {
        window.addEventListener("resize", this.onScroll);
      }
    }
    for (const el of [content, scroller].filter((e): e is HTMLElement => e != null)) {
      if (!this.observed.has(el)) {
        this.observed.add(el);
        this.resizeObserver.observe(el);
      }
    }
    this.measure();
  }

  /** Scrolls so item `index` is at the top of the viewport. */
  scrollToIndex(index: number, behavior: ScrollBehavior = "auto") {
    const content = this.options.content();
    if (!content) {
      return;
    }
    const top = this.offsets.offsets[Math.max(0, Math.min(index, this.offsets.count))];
    const delta = top - this.currentScrollOffset(content);
    if (this.scrollTarget instanceof HTMLElement) {
      this.scrollTarget.scrollBy({ top: delta, behavior });
    } else {
      window.scrollBy({ top: delta, behavior });
    }
  }

  private onScroll = () => this.measure();

  private measure() {
    if (!this.options.content()) {
      return;
    }
    this.measured = true;
    const next = this.compute();
    if (next.start !== this.range.start || next.end !== this.range.end) {
      this.range = next;
      this.host.requestUpdate();
    }
  }

  private currentScrollOffset(content: HTMLElement): number {
    const contentTop = content.getBoundingClientRect().top;
    if (this.scrollTarget instanceof HTMLElement) {
      const scroller = this.scrollTarget;
      return scroller.getBoundingClientRect().top + scroller.clientTop - contentTop;
    }
    return -contentTop;
  }

  private viewportSize(): number {
    return this.scrollTarget instanceof HTMLElement
      ? this.scrollTarget.clientHeight
      : window.innerHeight;
  }

  private compute(): VirtualRange {
    const content = this.options.content();
    if (!content || !this.scrollTarget) {
      return { start: 0, end: Math.min(this.offsets.count, INITIAL_COUNT) };
    }
    return this.offsets.range(this.currentScrollOffset(content), this.viewportSize());
  }

  private detach() {
    this.scrollTarget?.removeEventListener("scroll", this.onScroll);
    if (this.scrollTarget === window) {
      window.removeEventListener("resize", this.onScroll);
    }
    this.scrollTarget = null;
    this.resizeObserver.disconnect();
    this.observed.clear();
  }
}
