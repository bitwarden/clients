import { ElementRef, Injectable, Signal, computed, inject, signal } from "@angular/core";

import { scrollDirection } from "../utils/scroll-direction";

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
  private readonly source = computed<HTMLElement | ElementRef<HTMLElement> | null>(
    () => this.reportedSource() ?? this.scrollLayout.scrollableRef(),
  );

  /**
   * Which way the page is being scrolled. One signal for the whole page: every collapse gives its
   * height back to the scroller, so per-region signals would fight each other.
   *
   * Summing heights into `minScrollable` only stays comparable to the scroller's `maxTop` while
   * every registered region sits outside the scrolled element. One registered inside would shrink
   * its `scrollHeight` instead, moving `maxTop` the opposite way.
   */
  readonly direction: Signal<"up" | "down"> = scrollDirection(this.source, {
    minScrollable: () => this.collapsibles().reduce((total, height) => total + height(), 0),
  });

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
