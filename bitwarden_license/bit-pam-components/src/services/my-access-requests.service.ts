import { Injectable } from "@angular/core";
import {
  catchError,
  concat,
  defer,
  distinctUntilChanged,
  EMPTY,
  filter,
  map,
  merge,
  Observable,
  of,
  ReplaySubject,
  share,
  shareReplay,
  switchMap,
  take,
  timer,
} from "rxjs";

import {
  AccessBadgeState,
  AccessRefreshService,
  AccessRequestSdkService,
  badgesFromMyRequests,
  nextRequestListChangeMs,
} from "@bitwarden/bit-pam";
import type { AccessRequestView } from "@bitwarden/bit-pam";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";

/**
 * The caller's own requests (`listMyAccessRequests`), one read shared by the nav count and the vault
 * list's badges. Read again on every access change, and when a window or a lease that gives a badge
 * ends, since nothing announces that. Dropped once nothing listens. A failed read logs and keeps the
 * active account's last good list, which is empty after an account switch.
 */
@Injectable()
export class MyAccessRequestsService {
  readonly requests$: Observable<readonly AccessRequestView[]>;

  /**
   * The vault list's badge for each cipher where the caller holds a lease or a request. A gated
   * cipher left out is Privileged.
   */
  readonly badges$: Observable<ReadonlyMap<string, AccessBadgeState>>;

  constructor(
    private readonly accessRequestSdkService: AccessRequestSdkService,
    private readonly accessRefreshService: AccessRefreshService,
    private readonly accountService: AccountService,
    private readonly ticker: AccessBadgeTickerService,
    private readonly logService: LogService,
  ) {
    this.requests$ = this.accountService.activeAccount$.pipe(
      getOptionalUserId,
      distinctUntilChanged(),
      switchMap((userId, index) =>
        userId == null
          ? of([])
          : concat(
              // After a switch, drop the previous account's list before this account's read lands.
              index === 0 ? EMPTY : of([]),
              merge(of(undefined), this.accessRefreshService.accessChanged$()).pipe(
                switchMap(() => this.read$()),
              ),
            ),
      ),
      // A consumer swapping its inputs unsubscribes and subscribes again in one task.
      share({
        connector: () => new ReplaySubject<readonly AccessRequestView[]>(1),
        resetOnRefCountZero: () => timer(0),
      }),
    );
    // No grace of its own: a returning subscriber gets the list replayed by `requests$`.
    this.badges$ = this.requests$.pipe(
      map((requests) => badgesFromMyRequests(requests, Date.now())),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  private read$(): Observable<readonly AccessRequestView[]> {
    return defer(() => this.accessRequestSdkService.listMyAccessRequests()).pipe(
      switchMap((requests) => {
        const next = nextRequestListChangeMs(requests, Date.now());
        return next === undefined
          ? of(requests)
          : concat(
              of(requests),
              this.ticker.ticks$.pipe(
                filter((nowMs) => nowMs >= next),
                take(1),
                switchMap(() => this.read$()),
              ),
            );
      }),
      catchError((error: unknown) => {
        this.logService.error(error);
        return EMPTY;
      }),
    );
  }
}
