import { ElementRef, Injectable, Signal, computed, inject, signal } from "@angular/core";

import { scrollDirection } from "../utils/scroll-direction";

import { ScrollLayoutService } from "./scroll-layout.directive";

/**
 * Tracks which element the page is scrolling and which regions collapse with it.
 *
 * A service is needed because the scroller and the collapsing regions live in unrelated
 * component trees — the same reason {@link ScrollLayoutService} exists.
 */
@Injectable({ providedIn: "root" })
export class ScrollCollapseService {
  private readonly scrollLayout = inject(ScrollLayoutService);

  /** The element last reported as scrolling by `ScrollCollapseSourceDirective`. */
  private readonly reportedSource = signal<HTMLElement | null>(null);

  /** The registered regions' chrome heights, whose total gates the collapse. */
  private readonly collapsibles = signal<readonly (() => number)[]>([]);

  /**
   * The element to watch. A reported source wins over the layout's scroll host: a page
   * whose content owns its own scroller (a `fill` table, say) leaves the host with
   * nothing to report, and pages without one keep working untouched.
   */
  private readonly source = computed<HTMLElement | ElementRef<HTMLElement> | null>(
    () => this.reportedSource() ?? this.scrollLayout.scrollableRef(),
  );

  /**
   * Which way the page is being scrolled. One signal for the whole page: every region's collapse
   * gives its height back to the scroller, so per-region signals would fight each other.
   *
   * `minScrollable` is the regions' combined height, which stops a collapse the scroller cannot
   * afford — see {@link scrollDirection}. Summing is only correct while **every registered region
   * sits outside the scrolled element and hands its height to it 1:1**, which is what makes the
   * total comparable to that element's `maxTop`. A region registered *inside* the scroller would
   * instead shrink its `scrollHeight`, moving `maxTop` the opposite way, and the gate would read
   * the difference as twice the error rather than none.
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
   * Count a region's height towards the chrome total that gates the collapse.
   *
   * Pass a height that never under-reports while the region is collapsed or animating — see
   * `settledHeight`. A plain `offsetHeight` read reports ~0 once collapsed, which would drop the
   * floor to nothing exactly when it is needed.
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
