import { css } from "lit";

import { attachDirective } from "./attach-directive";
import { ScrollDirection, ScrollDirectionTracker } from "./scroll-direction";
import { scrollLayout } from "./scroll-layout";
import { settledHeight } from "./settled-height";

/** A region that collapses with the page. */
export type CollapseRegion = {
  /** Never under-report while collapsed or animating — see `settledHeight`. */
  height: () => number;

  /**
   * The element to draw the page's seam on, or `null` while this region shouldn't. Left off by a
   * region that only lends its height — one that keeps a border of its own.
   */
  seam?: () => HTMLElement | null;
};

/**
 * Tracks which element the page is scrolling and which regions collapse with it. A singleton
 * because the scroller and the collapsing regions live in unrelated component trees. Replaces
 * `ScrollCollapseService`.
 */
class ScrollCollapse {
  private reportedSource: HTMLElement | null = null;
  private regions: readonly CollapseRegion[] = [];
  private scrolledSource: HTMLElement | null = null;
  private _scrolled = false;
  private readonly listeners = new Set<() => void>();

  /**
   * Summing heights into `minScrollable` only stays comparable to the scroller's `maxTop` while
   * every registered region sits outside the scrolled element. One registered inside would shrink
   * its `scrollHeight` instead, moving `maxTop` the opposite way.
   */
  private readonly tracker = new ScrollDirectionTracker(
    { minScrollable: () => this.regions.reduce((total, region) => total + region.height(), 0) },
    () => this.notify(),
  );

  constructor() {
    this.syncSource();
    scrollLayout.subscribe(() => {
      this.syncSource();
      this.notify();
    });
  }

  /**
   * A reported source wins over the layout's scroll host, since a page whose content owns its own
   * scroller leaves the host with nothing to report.
   */
  private get source(): HTMLElement | null {
    return this.reportedSource ?? scrollLayout.scrollable;
  }

  /**
   * Whether the page's scroll region is away from the top. `direction` can't stand in: it reports
   * `"up"` both at the top and while scrolling back up from further down.
   */
  get scrolled(): boolean {
    return this._scrolled;
  }

  /**
   * Which way the page is being scrolled. One value for the whole page: every collapse gives its
   * height back to the scroller, so per-region directions would fight each other.
   *
   * A restored scroll position reports `"down"`, so the collapsing regions arrive collapsed rather
   * than animating into it; whoever restores it clears the flag on the user's first real scroll.
   */
  get direction(): ScrollDirection {
    return scrollLayout.restoredScrolled ? "down" : this.tracker.direction;
  }

  /** Whether the collapse comes from a restored scroll position, so regions skip their transition. */
  get restoring(): boolean {
    return scrollLayout.restoredScrolled;
  }

  /** Whether `region` draws the page's seam right now: the bottom-most region offering one. */
  ownsSeam(region: CollapseRegion): boolean {
    if (!this._scrolled) {
      return false;
    }
    let owner: CollapseRegion | null = null;
    let ownerElement: HTMLElement | null = null;
    for (const candidate of this.regions) {
      const element = candidate.seam?.();
      if (!element) {
        continue;
      }
      const below =
        ownerElement === null ||
        (ownerElement.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      if (below) {
        owner = candidate;
        ownerElement = element;
      }
    }
    return owner === region;
  }

  /** Report the element being scrolled. */
  setSource(element: HTMLElement) {
    if (element !== this.reportedSource) {
      this.reportedSource = element;
      this.syncSource();
      this.notify();
    }
  }

  /** Stop treating `element` as the scroller, if it still is. */
  clearSource(element: HTMLElement) {
    // Out-of-order destruction must not clobber a live source.
    if (this.reportedSource === element) {
      this.reportedSource = null;
      this.syncSource();
      this.notify();
    }
  }

  /**
   * Count a region towards the collapsible height that gates the collapse, and towards the page's
   * seam where it offers one. Registration compares by identity.
   */
  register(region: CollapseRegion) {
    if (!this.regions.includes(region)) {
      this.regions = [...this.regions, region];
      this.notify();
    }
  }

  unregister(region: CollapseRegion) {
    this.regions = this.regions.filter((candidate) => candidate !== region);
    this.notify();
  }

  /** Runs `listener` on any change. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private syncSource() {
    const source = this.source;
    this.tracker.setElement(source);
    if (source !== this.scrolledSource) {
      this.scrolledSource?.removeEventListener("scroll", this.onSourceScroll);
      this.scrolledSource = source;
      source?.addEventListener("scroll", this.onSourceScroll, { passive: true });
      this.onSourceScroll();
    }
  }

  private readonly onSourceScroll = () => {
    const scrolled = (this.scrolledSource?.scrollTop ?? 0) !== 0;
    if (scrolled !== this._scrolled) {
      this._scrolled = scrolled;
      this.notify();
    }
  };

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

export const scrollCollapse = new ScrollCollapse();

/**
 * Whether an element has vertical scrolling to report. A horizontal scroller says nothing about how
 * far the page has been read — a table's header row scrolls sideways in step with its body.
 */
const scrollsVertically = (element: HTMLElement): boolean => {
  if (element.scrollHeight <= element.clientHeight) {
    return false;
  }
  // Clipped overflow still reports a scroll range, so the range alone can't tell the two apart.
  const { overflowY } = getComputedStyle(element);
  return overflowY !== "hidden" && overflowY !== "clip";
};

/**
 * Marks a container whose content scrolls, so regions marked with `attachCollapseOnScroll`
 * collapse against it. Replaces `bitScrollCollapseSource`.
 *
 * Goes on the container rather than the scroller itself, since the scrolling element is often an
 * implementation detail of a component.
 */
export function attachScrollCollapseSource(host: HTMLElement): { destroy(): void } {
  let reported: HTMLElement | null = null;
  // `scroll` doesn't bubble, but a capture listener still observes it, so the scrolling
  // descendant identifies itself as the event target. `composedPath` reaches into shadow roots.
  const onScroll = (event: Event) => {
    const target = event.composedPath()[0];
    if (!(target instanceof HTMLElement) || !scrollsVertically(target)) {
      return;
    }
    reported = target;
    scrollCollapse.setSource(target);
  };
  host.addEventListener("scroll", onScroll, { capture: true });
  return {
    destroy() {
      host.removeEventListener("scroll", onScroll, { capture: true });
      if (reported) {
        scrollCollapse.clearSource(reported);
      }
    },
  };
}

/** Lit directive for `attachScrollCollapseSource`. */
export const scrollCollapseSource = attachDirective<void>(
  (el) => attachScrollCollapseSource(el),
  "scrollCollapseSource",
);

/** Where a collapsing region currently sits. Published on `data-state`. */
export type CollapseOnScrollState = "collapsed" | "expanded";

const COLLAPSE_ATTR = "bit-collapse-on-scroll";

/**
 * The collapse is a single-row grid animating `grid-template-rows` between `1fr` and `0fr`, so
 * there is no height ceiling to guess. `min-height: 0` lets the child shrink past its content
 * height, which a grid item's automatic minimum size would otherwise prevent. `hidden` still hides.
 */
const collapseStyles = css`
  [bit-collapse-on-scroll]:not([hidden]) {
    display: grid;
  }
  [bit-collapse-on-scroll] {
    overflow: hidden;
    grid-template-rows: 1fr;
    transition-duration: 200ms;
    transition-timing-function: ease-out;
    transition-property: none;
    border: 0 solid transparent;
    border-bottom-width: 1px;
  }
  [bit-collapse-on-scroll] > * {
    min-height: 0;
  }
  @media (prefers-reduced-motion: no-preference) {
    [bit-collapse-on-scroll]:not([data-restoring]) {
      transition-property: grid-template-rows, border-color;
    }
  }
  [bit-collapse-on-scroll][data-state="collapsed"] {
    grid-template-rows: 0fr;
  }
  /* The child's padding still sizes the track, since padding sits outside the content box where
     min-height never reaches it. */
  [bit-collapse-on-scroll][data-state="collapsed"] > * {
    padding-top: 0 !important;
    padding-bottom: 0 !important;
  }
  [bit-collapse-on-scroll][data-seam] {
    border-bottom-color: var(--color-border-base);
  }
`;

const installed = new WeakSet<Document | ShadowRoot>();

function installStyles(el: Element) {
  const root = el.getRootNode();
  if (
    !(root instanceof Document || root instanceof ShadowRoot) ||
    installed.has(root) ||
    !collapseStyles.styleSheet
  ) {
    return;
  }
  installed.add(root);
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, collapseStyles.styleSheet];
}

export type CollapseOnScrollOptions = {
  /** Whether to collapse at all, so a consumer can gate the behavior. Defaults to `true`. */
  enabled?: boolean;
};

export type CollapseOnScrollHandle = {
  update(options: CollapseOnScrollOptions): void;
  readonly state: CollapseOnScrollState;
  destroy(): void;
};

/**
 * Collapses `el` while the user scrolls down the page's scroll region — the layout's `<main>`, or a
 * scroll collapse source where one reports — and restores it as soon as they scroll back up. For
 * short viewports — the extension popup especially — where that space is worth more as content.
 * Replaces `bitCollapseOnScroll`.
 *
 * The element must have exactly one element child, which becomes the collapsing row. Put block
 * padding on that child rather than here, so it collapses with the row.
 *
 * The region is only ever visually clipped, never removed from the accessibility tree, so tabbing
 * into it brings it into view. Focus already inside when the collapse comes due is left where it
 * is. Under `prefers-reduced-motion: reduce` the collapse is instant.
 *
 * The bottom border belongs to this behavior: the bottom-most expanded region on a page draws the
 * seam dividing the regions above the scroll area from the scrolled content.
 */
export function attachCollapseOnScroll(
  el: HTMLElement,
  options: CollapseOnScrollOptions = {},
): CollapseOnScrollHandle {
  installStyles(el);
  if (!el.isConnected) {
    // A Lit directive attaches before its template is committed, when the root isn't known yet.
    queueMicrotask(() => installStyles(el));
  }
  let enabled = options.enabled ?? true;

  /**
   * Whether focus arrived while this region was collapsed, which holds it open so it can be tabbed
   * into. Focus that predates the collapse is left where it is and doesn't veto the collapse.
   */
  let focusHoldsOpen = false;

  const computeState = (): CollapseOnScrollState =>
    enabled && !focusHoldsOpen && scrollCollapse.direction === "down" ? "collapsed" : "expanded";
  const expanded = () => computeState() === "expanded";

  const height = settledHeight(el, expanded);
  const region: CollapseRegion = {
    height: height.measure,
    // Collapsed, the region offers no seam: it holds its border box, so one drawn there would
    // stack against the region above it.
    seam: () => (expanded() ? el : null),
  };

  let registered = false;
  const render = () => {
    // An opted-out region keeps its own box rather than gain a grid and clipping it never asked for.
    if (!enabled) {
      el.removeAttribute(COLLAPSE_ATTR);
      el.removeAttribute("data-state");
      el.removeAttribute("data-seam");
      el.removeAttribute("data-restoring");
      if (registered) {
        registered = false;
        scrollCollapse.unregister(region);
      }
      return;
    }
    if (!registered) {
      registered = true;
      scrollCollapse.register(region);
    }
    el.setAttribute(COLLAPSE_ATTR, "");
    el.setAttribute("data-state", computeState());
    el.toggleAttribute("data-seam", scrollCollapse.ownsSeam(region));
    // A restored scroll position is already where the user left it, so there is nothing to
    // animate from.
    el.toggleAttribute("data-restoring", scrollCollapse.restoring);
  };

  const onFocusIn = () => {
    focusHoldsOpen = scrollCollapse.direction === "down";
    render();
  };
  const onFocusOut = () => {
    focusHoldsOpen = false;
    render();
  };
  el.addEventListener("focusin", onFocusIn);
  el.addEventListener("focusout", onFocusOut);
  const unsubscribe = scrollCollapse.subscribe(render);
  render();

  return {
    update(next) {
      enabled = next.enabled ?? true;
      render();
    },
    get state() {
      return computeState();
    },
    destroy() {
      unsubscribe();
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      height.destroy();
      enabled = false;
      render();
    },
  };
}

/** Lit directive for `attachCollapseOnScroll`. */
export const collapseOnScroll = attachDirective<CollapseOnScrollOptions | undefined>(
  (el, options) => attachCollapseOnScroll(el, options),
  "collapseOnScroll",
);
