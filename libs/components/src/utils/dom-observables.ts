import { Observable } from "rxjs";

/** IntersectionObserver Observable */
export const intersectionObserver$ = (
  target: Element,
  init: IntersectionObserverInit,
): Observable<IntersectionObserverEntry> => {
  return new Observable((sub) => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        sub.next(e);
      }
    }, init);
    io.observe(target);
    return () => io.disconnect();
  });
};
