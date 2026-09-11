import { DestroyRef, Directive, ElementRef, OnDestroy, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { fromEvent } from "rxjs";

import { ScrollCollapseService } from "./scroll-collapse.service";

/**
 * Whether an element has vertical scrolling to report.
 *
 * A container can hold several scrollers, and a horizontal one says nothing about how far the page
 * has been read — a table's header row scrolls sideways in step with its body, and adopting that
 * would hand the collapse a vertical range that isn't the one the user is scrolling.
 */
const scrollsVertically = (element: HTMLElement): boolean => {
  if (element.scrollHeight <= element.clientHeight) {
    return false;
  }

  // Clipped overflow still reports a scroll range, so the range alone isn't enough to tell a
  // vertical scroller from a sideways one that happens to have taller content than it shows.
  const { overflowY } = getComputedStyle(element);
  return overflowY !== "hidden" && overflowY !== "clip";
};

/**
 * Marks a container whose content scrolls, so regions marked with `bitCollapseOnScroll`
 * collapse against it.
 *
 * Put this on the container rather than the scroller itself: the scrolling element is
 * often an implementation detail that gets swapped out. `bit-table-v2` alone moves
 * between a virtual-scroll viewport, a plain overflow container, a loading state, and an
 * empty state — so naming it from the outside would go stale.
 */
@Directive({
  selector: "[bitScrollCollapseSource]",
})
export class ScrollCollapseSourceDirective implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly service = inject(ScrollCollapseService);
  private readonly destroyRef = inject(DestroyRef);

  /** The scroller this directive last reported, so only that one is cleared on destroy. */
  private reported: HTMLElement | null = null;

  constructor() {
    // `scroll` doesn't bubble, but a capture listener on an ancestor still observes it,
    // so the scrolling descendant identifies itself as the event target. That's what
    // keeps this generic: no querying, and nothing to re-resolve when the DOM changes.
    fromEvent(this.host.nativeElement, "scroll", { capture: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !scrollsVertically(target)) {
          return;
        }

        this.reported = target;
        this.service.setSource(target);
      });
  }

  ngOnDestroy(): void {
    if (this.reported) {
      this.service.clearSource(this.reported);
    }
  }
}
