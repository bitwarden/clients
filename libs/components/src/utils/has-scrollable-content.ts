import { Observable, animationFrameScheduler } from "rxjs";
import { auditTime, map, startWith, observeOn, distinctUntilChanged } from "rxjs/operators";

import { intersectionObserver$ } from "./dom-observables";
/**
 * Utility to determine if an element has scrollable content.
 * Returns an Observable that emits whenever scroll/resize/layout might change visibility
 */
export const hasScrollableContent$ = (
  root: HTMLElement,
  target: HTMLElement,
  threshold: number = 1,
): Observable<boolean> => {
  return intersectionObserver$(target, { root, threshold }).pipe(
    startWith(null as IntersectionObserverEntry | null),
    auditTime(0, animationFrameScheduler),
    observeOn(animationFrameScheduler),
    map((entry: IntersectionObserverEntry | null) => {
      if (!entry) {
        document.body.prepend(
          `[without entry: root ${root.scrollHeight} > client ${root.clientHeight}]`,
        );
        return root.scrollHeight > root.clientHeight;
      }
      document.body.prepend(`[with entry: ${!entry.isIntersecting}]`);
      return !entry.isIntersecting;
    }),
    distinctUntilChanged(),
  );
};
