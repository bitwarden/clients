import { Injectable, NgZone, inject } from "@angular/core";
import { Observable, share } from "rxjs";

/**
 * One shared 1-second clock for lease countdowns, so a table of badges runs one interval. It
 * ticks outside the Angular zone, since an in-zone timer would hang `whenStable()` for any host
 * embedding a badge.
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
