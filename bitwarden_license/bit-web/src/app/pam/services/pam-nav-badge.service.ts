import {
  catchError,
  EMPTY,
  distinctUntilChanged,
  from,
  map,
  merge,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PamNavBadgeService } from "@bitwarden/web-vault/app/pam/pam-nav-badge.service";

import { AccessEventService, AccessRequestSdkService, actionableRequestCount } from "..";

/**
 * PAM's {@link PamNavBadgeService}: how many of the caller's own access requests still need something
 * from them, refreshed whenever the server says their access changed.
 *
 * `shareReplay({ refCount: true })` because the nav slot and anything else that badges the same
 * number must not each fire their own `list_mine()`, while `refCount` still releases the upstream
 * subscription — and with it the push-channel attachment — once nothing is rendering a badge.
 *
 * A failed read reports the previous count rather than erroring: a nav badge must never be able to
 * break navigation. With the feature flag off it reports `0` without calling the SDK at all.
 */
export class DefaultPamNavBadgeService implements PamNavBadgeService {
  readonly count$: Observable<number>;

  constructor(
    private accessRequestSdkService: AccessRequestSdkService,
    private accessEventService: AccessEventService,
    private configService: ConfigService,
    private logService: LogService,
  ) {
    this.count$ = this.configService.getFeatureFlag$(FeatureFlag.Pam).pipe(
      switchMap((enabled) => (enabled ? this.liveCount$() : of(0))),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  private liveCount$(): Observable<number> {
    return merge(of(undefined), this.accessEventService.accessChanged$()).pipe(
      switchMap(() =>
        from(this.accessRequestSdkService.listMyAccessRequests()).pipe(
          map((requests) => actionableRequestCount(requests, new Date())),
          catchError((error: unknown) => {
            this.logService.error(error);
            return EMPTY;
          }),
        ),
      ),
      startWith(0),
    );
  }
}
