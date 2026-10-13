import { Injectable, Signal, computed, inject, signal } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { fromEvent, map, of, startWith, switchMap } from "rxjs";

import { ScrollDirection, scrollDirection } from "../utils/scroll-direction";

import { ScrollLayoutService } from "./scroll-layout.directive";

/** A region that collapses with the page. */
export type CollapseRegion = {
  /** Never under-report while collapsed or animating — see `settledHeight`. */
  height: () => number;

  /**
   * The element to draw the page's seam on, or `null` while this region shouldn't. Left off by a
   * region that only lends its height — one that keeps a border of its own.
   */
  seam?: Signal<HTMLElement | null>;
};

/**
 * Tracks which element the page is scrolling and which regions collapse with it. A service because
 * the scroller and the collapsing regions live in unrelated component trees.
 */
@Injectable({ providedIn: "root" })
export class ScrollCollapseService {
  private readonly scrollLayout = inject(ScrollLayoutService);

  /** The element last reported by `ScrollCollapseSourceDirective`. */
  private readonly reportedSource = signal<HTMLElement | null>(null);

  private readonly collapsibles = signal<readonly CollapseRegion[]>([]);

  /**
   * A reported source wins over the layout's scroll host, since a page whose content owns its own
   * scroller leaves the host with nothing to report.
   */
  private readonly source = computed<HTMLElement | null>(
    () => this.reportedSource() ?? this.scrollLayout.scrollableRef()?.nativeElement ?? null,
  );

  /** The height the registered regions would hand back to the scroller by collapsing. */
  private readonly collapsibleHeight = () =>
    this.collapsibles().reduce((total, region) => total + region.height(), 0);

  /**
   * Summing heights into `minScrollable` only stays comparable to the scroller's `maxTop` while
   * every registered region sits outside the scrolled element. One registered inside would shrink
   * its `scrollHeight` instead, moving `maxTop` the opposite way.
   */
  private readonly scrolling = scrollDirection(this.source, {
    minScrollable: this.collapsibleHeight,
  });

  /**
   * Whether the page's scroll region is away from the top. `direction` can't stand in: it reports
   * `"up"` both at the top and while scrolling back up from further down.
   */
  readonly scrolled: Signal<boolean> = toSignal(
    toObservable(this.source).pipe(
      switchMap((element) =>
        element
          ? fromEvent(element, "scroll").pipe(
              startWith(null),
              map(() => element.scrollTop !== 0),
            )
          : of(false),
      ),
    ),
    { initialValue: false },
  );

  /**
   * Which way the page is being scrolled. One signal for the whole page: every collapse gives its
   * height back to the scroller, so per-region signals would fight each other.
   *
   * A restored scroll position reports `"down"`, so the collapsing regions arrive collapsed rather
   * than animating into it; whoever restores it clears the flag on the user's first real scroll.
   */
  readonly direction: Signal<ScrollDirection> = computed(() =>
    this.scrollLayout.restoredScrolled() ? "down" : this.scrolling(),
  );

  /**
   * Whether the collapse on the page comes from a restored scroll position rather than a scroll.
   * Regions skip their transition while this holds, so the page arrives collapsed instead of
   * animating into it.
   */
  readonly restoring: Signal<boolean> = this.scrollLayout.restoredScrolled;

  /**
   * The region drawing the page's seam — the one rule dividing the regions above the scroll area
   * from the scrolled content. The bottom-most region offering one, by document position rather
   * than registration order.
   */
  private readonly seamOwner = computed<CollapseRegion | null>(() => {
    let owner: CollapseRegion | null = null;
    let ownerElement: HTMLElement | null = null;

    for (const region of this.collapsibles()) {
      const element = region.seam?.();
      if (!element) {
        continue;
      }

      const below =
        ownerElement === null ||
        (ownerElement.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

      if (below) {
        owner = region;
        ownerElement = element;
      }
    }

    return owner;
  });

  /** Whether `region` draws the page's seam right now. @see {@link seamOwner} */
  ownsSeam(region: CollapseRegion): Signal<boolean> {
    return computed(() => this.scrolled() && this.seamOwner() === region);
  }

  /**
   * Whether `element` has more left to scroll than collapsing every region would hand back to it.
   *
   * The floor `minScrollable` applies to a direction flip, which a restored scroll position never
   * makes, so a restore has to ask before declaring itself: collapsing more than the scroller can
   * afford lets the browser clamp the offset, which reads as `"up"` and reopens the regions
   * (CL-1318). A plain method rather than a signal, since the regions' heights consult their own
   * collapse state — reading them inside a `computed` that feeds `direction` would be a cycle.
   */
  affordsCollapse(element: HTMLElement): boolean {
    return element.scrollHeight - element.clientHeight > this.collapsibleHeight();
  }

  /** Report the element being scrolled. */
  setSource(element: HTMLElement): void {
    this.reportedSource.set(element);
  }

  /** Stop treating `element` as the scroller, if it still is. */
  clearSource(element: HTMLElement): void {
    // Out-of-order destruction must not clobber a live source.
    if (this.reportedSource() === element) {
      this.reportedSource.set(null);
    }
  }

  /**
   * Count a region towards the collapsible height that gates the collapse, and towards the page's
   * seam where it offers one. Hold one stable object per region; registration compares by identity.
   */
  register(region: CollapseRegion): void {
    this.collapsibles.update((current) =>
      current.includes(region) ? current : [...current, region],
    );
  }

  /** @see {@link register} */
  unregister(region: CollapseRegion): void {
    this.collapsibles.update((current) => current.filter((candidate) => candidate !== region));
  }
}
