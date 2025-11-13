import { Observable, of, timer } from "rxjs";
import { switchMap } from "rxjs/operators";

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
    let skeletonShownAt: number | null = null;

    const showSkeleton = (): Observable<boolean> => {
      if (skeletonShownAt !== null) {
        return of(true); // Already showing, just emit true
      }

      // Wait before showing, then mark timestamp and emit true
      return timer(showDelay).pipe(
        switchMap(() => {
          skeletonShownAt = Date.now();
          return of(true);
        }),
      );
    };

    const hideSkeleton = (): Observable<boolean> => {
      if (skeletonShownAt === null) {
        return of(false); // Never shown, hide immediately
      }

      // Calculate remaining minimum display time
      const elapsedTime = Date.now() - skeletonShownAt;
      const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

      // Wait for remaining time (if any), then reset and hide
      return timer(remainingTime).pipe(
        switchMap(() => {
          skeletonShownAt = null;
          return of(false);
        }),
      );
    };

    return source.pipe(switchMap((shouldShow) => (shouldShow ? showSkeleton() : hideSkeleton())));
  };
}
