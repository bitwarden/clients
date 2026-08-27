import { Injectable, NgZone, inject } from "@angular/core";
import { Observable, share } from "rxjs";

/**
 * The one 1-second clock every {@link AccessStateBadgeComponent} shares while it shows an active
 * lease countdown. A vault table can host dozens of badges; without this, each would own its own
 * `setInterval`, so N active badges would mean N independent per-second timers.
 *
 * `share({ resetOnRefCountZero: true })` starts the underlying interval on the first subscriber
 * and tears it down on the last unsubscribe, so a screen with zero active badges holds no timer at
 * all. The interval itself is created inside `runOutsideAngular` from within the source factory,
 * not from the constructor, because `share` re-subscribes to the source on every 0-to-1 transition
 * and a subscriber may (re)trigger that from inside the Angular zone; wrapping the `setInterval`
 * call site is the only way to guarantee it never runs in-zone. A periodic in-zone timer would
 * trigger change detection every second for as long as any badge is active and would never let
 * NgZone settle, which hangs `fixture.whenStable()` for any host that embeds a badge.
 */
@Injectable({ providedIn: "root" })
export class AccessBadgeTickerService {
  private readonly ngZone = inject(NgZone);

  readonly ticks$: Observable<number> = new Observable<number>((subscriber) => {
    let intervalId: ReturnType<typeof setInterval>;
    this.ngZone.runOutsideAngular(() => {
      intervalId = setInterval(() => subscriber.next(Date.now()), 1000);
    });
    return () => clearInterval(intervalId);
  }).pipe(share({ resetOnRefCountZero: true }));
}
