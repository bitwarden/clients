import { Injectable, inject } from "@angular/core";
import {
  BehaviorSubject,
  Observable,
  Subscription,
  catchError,
  distinctUntilChanged,
  from,
  map,
  of,
  switchMap,
  timer,
} from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PamApiService } from "@bitwarden/pam";

/**
 * Polls the inbox badge count while the {@link FeatureFlag.Pam} flag is on.
 * Designed to live for the user-layout lifetime (singleton via `providedIn: "root"`).
 *
 * Errors are swallowed — a nav badge must never break navigation. They are
 * logged and the badge stays at its last known value.
 */
@Injectable({ providedIn: "root" })
export class ApproverInboxBadgeService {
  private readonly configService = inject(ConfigService);
  private readonly pamApiService = inject(PamApiService);
  private readonly logService = inject(LogService);

  /** Default poll interval; chosen to balance freshness with API load. */
  private static readonly POLL_INTERVAL_MS = 60_000;

  private readonly _count$ = new BehaviorSubject<number>(0);
  readonly count$: Observable<number> = this._count$.pipe(distinctUntilChanged());

  private subscription: Subscription | null = null;

  constructor() {
    this.subscription = this.configService
      .getFeatureFlag$(FeatureFlag.Pam)
      .pipe(
        switchMap((enabled) =>
          enabled
            ? timer(0, ApproverInboxBadgeService.POLL_INTERVAL_MS).pipe(
                switchMap(() =>
                  from(this.pamApiService.getInboxBadgeCount()).pipe(
                    map((response) => response.count),
                    catchError((e: unknown) => {
                      this.logService.error(e);
                      return of(this._count$.value);
                    }),
                  ),
                ),
              )
            : of(0),
        ),
      )
      .subscribe((count) => this._count$.next(count));
  }

  /** Force an immediate refresh; used after a decision settles. */
  async refresh(): Promise<void> {
    try {
      const response = await this.pamApiService.getInboxBadgeCount();
      this._count$.next(response.count);
    } catch (e) {
      this.logService.error(e);
    }
  }

  /** For test cleanup. */
  destroy(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }
}
