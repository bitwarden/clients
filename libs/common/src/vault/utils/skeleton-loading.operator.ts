import { defer, Observable, of, timer } from "rxjs";
import { map, switchMap, tap } from "rxjs/operators";

/**
 * RxJS operator that adds skeleton loading delay behavior.
 *
 * - Waits 1 second before showing (prevents flashing for quick loads)
 * - Ensures skeleton stays visible for at least 1 second once shown regardless of the source observable emissions
 * - After the minimum display time, if the source is still true, continues to emit true until the source becomes false
 * - False can only be emitted either:
 *   - Immediately when the source emits false before the skeleton is shown
 *   - After the minimum display time has passed once the skeleton is shown
 */
export function skeletonLoadingDelay(
  showDelay = 1000,
  minDisplayTime = 1000,
): (source: Observable<boolean>) => Observable<boolean> {
  return (source: Observable<boolean>) => {
    return defer(() => {
      let skeletonShownAt: number | null = null;

      return source.pipe(
        switchMap((shouldShow): Observable<boolean> => {
          if (shouldShow) {
            if (skeletonShownAt !== null) {
              return of(true); // Already shown, continue showing
            }

            // Wait for delay, then mark the skeleton as shown and emit true
            return timer(showDelay).pipe(
              tap(() => {
                skeletonShownAt = Date.now();
              }),
              map(() => true),
            );
          } else {
            if (skeletonShownAt === null) {
              // Skeleton not shown yet, can emit false immediately
              return of(false);
            }

            // Skeleton shown, ensure minimum display time has passed
            const elapsedTime = Date.now() - skeletonShownAt;
            const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

            // Wait for remaining time to ensure minimum display time
            return timer(remainingTime).pipe(
              tap(() => {
                // Reset the shown timestamp
                skeletonShownAt = null;
              }),
              map(() => false),
            );
          }
        }),
      );
    });
  };
}
