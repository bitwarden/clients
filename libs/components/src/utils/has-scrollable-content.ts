import { Observable, merge, animationFrameScheduler } from "rxjs";
import { auditTime, map, startWith, observeOn, distinctUntilChanged } from "rxjs/operators";

/** IntersectionObserver → Observable */
function intersection$(
  target: Element,
  init: IntersectionObserverInit,
): Observable<IntersectionObserverEntry> {
  return new Observable((sub) => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        sub.next(e);
      }
    }, init);
    io.observe(target);
    return () => io.disconnect();
  });
}

/** ResizeObserver → Observable */
function resize$(...els: Element[]): Observable<void> {
  return new Observable((sub) => {
    const ro = new ResizeObserver(() => sub.next());
    els.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  });
}

/**
 * Utility to determine if an element has scrollable content.
 * Returns an Observable that emits whenever scroll/resize/layout might change visibility
 */
export const hasScrollableContent$ = (
  root: HTMLElement,
  target: HTMLElement,
  threshold: number = 1,
): Observable<boolean> => {
  const intersectionObserver$ = intersection$(target, { root, threshold });
  const resizeObserver$ = resize$(root, target).pipe(map(() => null));

  return merge(intersectionObserver$, resizeObserver$).pipe(
    startWith(null as IntersectionObserverEntry | null),
    auditTime(0, animationFrameScheduler),
    observeOn(animationFrameScheduler),
    map((entry: IntersectionObserverEntry | null) => {
      if (!entry) {
        return root.scrollHeight > root.clientHeight;
      }
      return !entry.isIntersecting;
    }),
    distinctUntilChanged(),
  );
};
