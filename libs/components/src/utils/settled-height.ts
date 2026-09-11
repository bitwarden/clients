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
 * An element's height as collapsing chrome, which never reports less than its expanded height.
 *
 * `scrollDirection`'s `minScrollable` gates a collapse on the scroller being able to afford it, so
 * under-reporting is the dangerous direction — a plain `offsetHeight` measures ~0 once collapsed and
 * something in between while animating open. The last settled height stands in for both.
 *
 * Measured on each call rather than cached, so content that appears later is reflected immediately;
 * the settled height is re-taken after any transition that finishes while expanded, which lets it
 * correct back down once the content shrinks.
 *
 * @param element The element to measure. Reports `0` while it is nullish.
 * @param expanded Whether the element is currently expanded.
 */
export const settledHeight = (
  element: Signal<ElementRef<HTMLElement> | HTMLElement | null | undefined>,
  expanded: Signal<boolean>,
): (() => number) => {
  const target = computed(() => nativeElement(element()));

  /** The last height measured expanded and with its transition finished. */
  let settled = 0;

  effect((onCleanup) => {
    const host = target();
    if (!host) {
      return;
    }

    // An element never transitions on its first style resolution, so it starts out settled.
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

  // A plain function rather than a `computed`, which would memoize a DOM read with no signal to
  // invalidate it.
  return () => {
    const host = target();
    if (!host) {
      return settled;
    }

    return expanded() ? Math.max(host.offsetHeight, settled) : settled;
  };
};
