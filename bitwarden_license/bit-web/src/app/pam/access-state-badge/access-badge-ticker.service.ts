import { Injectable, NgZone, inject } from "@angular/core";
import { Observable, share } from "rxjs";

/**
 * The one 1-second clock every {@link AccessStateBadgeComponent} shares while it shows an
 * active lease countdown. A vault table can host dozens of badges; without this, each would
 * own its own `setInterval`.
 *
 * `share({ resetOnRefCountZero: true })` starts the interval on the first subscriber and tears
 * it down on the last unsubscribe. The interval is created inside `runOutsideAngular` from the
 * source factory, not the constructor, since `share` re-subscribes on every 0-to-1 transition
 * and only wrapping the `setInterval` call site guarantees it never runs in-zone.
 *
 * An in-zone timer would trigger change detection every second for as long as any badge is
 * active, hanging `fixture.whenStable()` for any host embedding a badge.
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
