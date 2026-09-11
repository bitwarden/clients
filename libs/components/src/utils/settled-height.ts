import { ElementRef, Signal, computed, effect, untracked } from "@angular/core";

const nativeElement = (
  target: ElementRef<HTMLElement> | HTMLElement | null | undefined,
): HTMLElement | null => {
  if (target instanceof ElementRef) {
    return target.nativeElement;
  }

  return target ?? null;
};

/**
 * An element's height as collapsing chrome, which never reports less than the height the element
 * would occupy expanded.
 *
 * `scrollDirection`'s `minScrollable` uses this to gate a collapse on the scroller being able to
 * afford it, so under-reporting is the dangerous direction: too small a floor lets through the very
 * collapse the floor exists to block. Two things would under-report a plain `offsetHeight`:
 *
 * - While collapsed the element measures ~0, so the last settled height stands in.
 * - While animating back open it measures somewhere in between, so the settled height floors it.
 *
 * Measuring on each call rather than caching keeps content that appears later — a callout resolving
 * into the region, compact mode, a title that starts wrapping — reflected immediately. The settled
 * height is re-taken whenever a transition finishes while expanded, which is what lets it correct
 * back down again once the content shrinks.
 *
 * Returns a plain function rather than a `computed`, which would memoize a DOM read that has no
 * signal to invalidate it.
 *
 * @param element The element to measure. Reports `0` while it is nullish.
 * @param expanded Whether the element is currently expanded.
 */
export const settledHeight = (
  element: Signal<ElementRef<HTMLElement> | HTMLElement | null | undefined>,
  expanded: Signal<boolean>,
): (() => number) => {
  const target = computed(() => nativeElement(element()));

  /** The last height measured with the element expanded and its transition finished. */
  let settled = 0;

  effect((onCleanup) => {
    const host = target();
    if (!host) {
      return;
    }

    // An element never transitions on its first style resolution, so its first measurement is
    // already settled. `untracked` because this reads a signal the effect should not subscribe to.
    if (untracked(expanded)) {
      settled = host.offsetHeight;
    }

    const onTransitionEnd = () => {
      if (untracked(expanded)) {
        settled = host.offsetHeight;
      }
    };

    host.addEventListener("transitionend", onTransitionEnd);
    onCleanup(() => host.removeEventListener("transitionend", onTransitionEnd));
  });

  return () => {
    const host = target();
    if (!host) {
      return settled;
    }

    return expanded() ? Math.max(host.offsetHeight, settled) : settled;
  };
};
