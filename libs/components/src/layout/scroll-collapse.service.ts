import { Injectable, Signal, computed, inject, signal } from "@angular/core";

import { ScrollDirection, scrollDirection } from "../utils/scroll-direction";

import { ScrollLayoutService } from "./scroll-layout.directive";

/**
 * Tracks which element the page is scrolling and which regions collapse with it. A service because
 * the scroller and the collapsing regions live in unrelated component trees.
 */
@Injectable({ providedIn: "root" })
export class ScrollCollapseService {
  private readonly scrollLayout = inject(ScrollLayoutService);

  /** The element last reported by `ScrollCollapseSourceDirective`. */
  private readonly reportedSource = signal<HTMLElement | null>(null);

  /** The registered regions' chrome heights, whose total gates the collapse. */
  private readonly collapsibles = signal<readonly (() => number)[]>([]);

  /**
   * A reported source wins over the layout's scroll host, since a page whose content owns its own
   * scroller leaves the host with nothing to report.
   */
  private readonly source = computed<HTMLElement | null>(
    () => this.reportedSource() ?? this.scrollLayout.scrollableRef()?.nativeElement ?? null,
  );

  /** The height the registered regions would hand back to the scroller by collapsing. */
  private readonly chromeHeight = () =>
    this.collapsibles().reduce((total, height) => total + height(), 0);

  /**
   * Summing heights into `minScrollable` only stays comparable to the scroller's `maxTop` while
   * every registered region sits outside the scrolled element. One registered inside would shrink
   * its `scrollHeight` instead, moving `maxTop` the opposite way.
   */
  private readonly scrolling = scrollDirection(this.source, {
    minScrollable: this.chromeHeight,
  });

  /**
   * Which way the page is being scrolled. One signal for the whole page: every collapse gives its
   * height back to the scroller, so per-region signals would fight each other.
   *
   * A restored scroll position reports `"down"`, so collapsing chrome arrives collapsed rather than
   * animating into it; whoever restores it clears the flag on the user's first real scroll.
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
   * Whether `element` has more left to scroll than collapsing every region would hand back to it.
   *
   * The floor `minScrollable` applies to a direction flip, which a restored scroll position never
   * makes, so a restore has to ask before declaring itself: collapsing more than the scroller can
   * afford lets the browser clamp the offset, which reads as `"up"` and reopens the chrome
   * (CL-1318). A plain method rather than a signal, since the regions' heights consult their own
   * collapse state — reading them inside a `computed` that feeds `direction` would be a cycle.
   */
  affordsCollapse(element: HTMLElement): boolean {
    return element.scrollHeight - element.clientHeight > this.chromeHeight();
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
   * Count a region's height towards the chrome total that gates the collapse. Pass a height that
   * never under-reports while collapsed or animating — see `settledHeight`.
   */
  register(height: () => number): void {
    this.collapsibles.update((current) =>
      current.includes(height) ? current : [...current, height],
    );
  }

  /** @see {@link register} */
  unregister(height: () => number): void {
    this.collapsibles.update((current) => current.filter((candidate) => candidate !== height));
  }
}
