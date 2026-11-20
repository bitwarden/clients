import { DestroyRef, Directive, ElementRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { fromEvent } from "rxjs";

import { ScrollCollapseService } from "./scroll-collapse.service";

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
 * Marks a container whose content scrolls, so regions marked with `bitCollapseOnScroll` collapse
 * against it.
 *
 * Goes on the container rather than the scroller itself, since the scrolling element is often an
 * implementation detail — `bit-table-v2` alone moves between a virtual-scroll viewport, a plain
 * overflow container, a loading state, and an empty state.
 */
@Directive({
  selector: "[bitScrollCollapseSource]",
})
export class ScrollCollapseSourceDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly service = inject(ScrollCollapseService);
  private readonly destroyRef = inject(DestroyRef);

  /** The scroller last reported, so only that one is cleared on destroy. */
  private reported: HTMLElement | null = null;

  constructor() {
    // `scroll` doesn't bubble, but a capture listener still observes it, so the scrolling
    // descendant identifies itself as the event target — nothing to re-resolve when the DOM changes.
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

    this.destroyRef.onDestroy(() => {
      if (this.reported) {
        this.service.clearSource(this.reported);
      }
    });
  }
}
