import { inject, NgZone, Signal } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { distinctUntilChanged, Observable } from "rxjs";

import { skeletonLoadingDelay } from "@bitwarden/common/vault/utils/skeleton-loading.operator";

/** {@link skeletonLoadingDelay}, with its timers kept out of the Angular zone. */
function delayOutsideAngular(zone: NgZone) {
  return (source: Observable<boolean>): Observable<boolean> =>
    new Observable<boolean>((subscriber) => {
      const outside = new Observable<boolean>((inner) =>
        source.subscribe({
          next: (value) => zone.runOutsideAngular(() => inner.next(value)),
          error: (error: unknown) => inner.error(error),
          complete: () => inner.complete(),
        }),
      );

      return outside.pipe(skeletonLoadingDelay()).subscribe({
        next: (value) => zone.run(() => subscriber.next(value)),
        error: (error: unknown) => subscriber.error(error),
        complete: () => subscriber.complete(),
      });
    });
}

/** Whether a loading flag has been raised long enough to be worth a placeholder. */
export function showSkeletonWhile(loading: Signal<boolean>): Signal<boolean> {
  const zone = inject(NgZone);
  return toSignal(toObservable(loading).pipe(distinctUntilChanged(), delayOutsideAngular(zone)), {
    initialValue: false,
  });
}
