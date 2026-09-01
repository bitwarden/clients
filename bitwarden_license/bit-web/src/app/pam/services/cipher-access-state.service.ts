import { Injectable, NgZone } from "@angular/core";
import {
  catchError,
  concat,
  defer,
  from,
  map,
  merge,
  Observable,
  of,
  Subject,
  switchMap,
  tap,
} from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import type { CipherAccessStateView } from "../abstractions/access-lease";
import { AccessRefreshService } from "../abstractions/access-refresh.service";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { leaseRemainingMs } from "../helpers/lease-liveness";

/**
 * The longest delay `setTimeout` can hold. Past `2^31 - 1` ms (~24.9 days) the delay overflows to
 * a near-zero one, so an uncapped wait on a far-off `notAfter` — a rule with no duration cap, a
 * lease extended over and over, a corrupt timestamp — would fire immediately, re-read, get the
 * same answer, and arm itself again every tick. Capping turns that into a harmless re-arm: the
 * timer wakes early, the re-read confirms the lease is still live, and the next wait is armed on
 * what remains.
 */
const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * The caller's access state for one cipher: re-read whenever it may have changed, and re-emitted
 * the moment an active lease's window closes.
 *
 * Every surface on an open gated item — the cipher-view banner, the item-details pill, and the
 * gated-cipher reloader — reads its state through here, so they cannot disagree about it and the
 * expiry handling below exists once rather than three times.
 *
 * A lease that simply runs out produces no event of any kind: nothing was mutated, so there is
 * nothing to announce on {@link AccessRefreshService}, and the server pushes nothing either,
 * because nothing happened on it — a moment merely passed. `cipher_access_state()` being a
 * one-shot read, an item left open across its own expiry would otherwise render the lease forever
 * and the reloader would never re-lock the credential it revealed (PM-41837). The timer closes
 * that gap: at `notAfter` the stream re-emits the state it already holds — so a consumer applying
 * {@link liveActiveLease} re-locks on the spot rather than waiting on a round trip — and then
 * re-reads, so the rest of the state comes back authoritative. The badge above all: only the SDK
 * may rank {@link CipherAccessStateView.badgeState}, so the honest way to retire an `active` one
 * is to ask the server again, not to re-derive it here.
 */
@Injectable()
export class CipherAccessStateService {
  constructor(
    private accessRequestSdkService: AccessRequestSdkService,
    private accessRefreshService: AccessRefreshService,
    private logService: LogService,
    private ngZone: NgZone,
  ) {}

  /**
   * `cipherId`'s access state, and every subsequent state it takes on. Never completes; consumers
   * own their teardown, and an unsubscribe cancels the pending expiry.
   */
  state$(cipherId: string): Observable<CipherAccessStateView | null> {
    return defer(() => {
      const lapsed$ = new Subject<void>();

      return merge(of(undefined), this.accessRefreshService.accessChanged$(cipherId), lapsed$).pipe(
        switchMap(() =>
          from(this.accessRequestSdkService.getCipherAccessState(cipherId)).pipe(
            catchError((error: unknown) => {
              // An unreadable access state leaves the item gated rather than revealing it, and
              // must not tear the stream down: the next change is still worth re-reading.
              this.logService.error(error);
              return of(null);
            }),
          ),
        ),
        switchMap((state) => {
          const remainingMs = leaseRemainingMs(state, Date.now());
          // `> 0` rather than `<= 0`, so an unparseable `notAfter` (NaN) also arms nothing. A
          // lease already past its window arms nothing either: consumers clamp it regardless, and
          // a timer against a moment gone by would fire at once, re-read, and arm itself again.
          if (remainingMs == null || !(remainingMs > 0)) {
            return of(state);
          }
          return concat(
            of(state),
            this.expiry$(Math.min(remainingMs, MAX_TIMEOUT_MS)).pipe(
              map(() => state),
              // On complete, not on next: `lapsed$` re-enters the switchMap above, which tears
              // this inner stream down. Announcing the lapse from `next` would do that before the
              // emission reached the consumers, and they would never see it.
              tap({ complete: () => lapsed$.next() }),
            ),
          );
        }),
      );
    });
  }

  /**
   * A one-shot tick `delayMs` from now, armed OUTSIDE the Angular zone and delivered inside it.
   *
   * A lease runs for minutes, so an in-zone timer would leave NgZone unsettled for its whole
   * length and hang `fixture.whenStable()` for every host that embeds a gated item —
   * `AccessBadgeTickerService` keeps its own clock out of the zone for the same reason. The
   * emission itself goes back in: what hangs off it is a re-lock that rewrites plain component
   * fields on the open dialog, which needs change detection to run behind it.
   */
  private expiry$(delayMs: number): Observable<void> {
    return new Observable<void>((subscriber) => {
      let timeoutId: ReturnType<typeof setTimeout>;
      this.ngZone.runOutsideAngular(() => {
        timeoutId = setTimeout(
          () =>
            this.ngZone.run(() => {
              subscriber.next();
              subscriber.complete();
            }),
          delayMs,
        );
      });
      return () => clearTimeout(timeoutId);
    });
  }
}
