import { Injectable, inject } from "@angular/core";
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subscription,
  distinctUntilChanged,
  filter,
  from,
  merge,
  of,
  switchMap,
} from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { PamApiService } from "@bitwarden/pam";

/**
 * Drives the nav-badge count of pending lease requests while
 * {@link FeatureFlag.Pam} is on. Singleton (`providedIn: "root"`) so the badge
 * survives across page navigations.
 *
 * Freshness is push-driven: the backend fires
 * {@link NotificationType.RefreshApproverInbox} whenever any approver-visible
 * row changes (new request, decision, lease revocation). On receipt — and on
 * initial flag enable — we re-fetch the inbox and take its length. No periodic
 * polling.
 *
 * Errors are swallowed — a nav badge must never break navigation.
 */
@Injectable({ providedIn: "root" })
export class ApproverInboxBadgeService {
  private readonly configService = inject(ConfigService);
  private readonly pamApiService = inject(PamApiService);
  private readonly notificationsService = inject(ServerNotificationsService);
  private readonly logService = inject(LogService);

  private readonly _count$ = new BehaviorSubject<number>(0);
  readonly count$: Observable<number> = this._count$.pipe(distinctUntilChanged());

  private subscription: Subscription | null = null;

  constructor() {
    this.subscription = this.configService
      .getFeatureFlag$(FeatureFlag.Pam)
      .pipe(
        switchMap((enabled) => (enabled ? this.refreshTriggers$() : this.zero$())),
        switchMap(() => from(this.fetchCount())),
      )
      .subscribe((count) => this._count$.next(count));
  }

  /** Force an immediate refresh; used after a decision settles. */
  async refresh(): Promise<void> {
    this._count$.next(await this.fetchCount());
  }

  /** For test cleanup. */
  destroy(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  private refreshTriggers$(): Observable<unknown> {
    return merge(
      // Fire once immediately so the badge populates on flag enable.
      of(null),
      this.notificationsService.notifications$.pipe(
        filter(([notification]) => notification.type === NotificationType.RefreshApproverInbox),
      ),
    );
  }

  private zero$(): Observable<never> {
    // Reset the count and skip the fetch when the flag is off.
    this._count$.next(0);
    return EMPTY;
  }

  private async fetchCount(): Promise<number> {
    try {
      const rows = await this.pamApiService.listInboxRequests();
      return rows.length;
    } catch (e) {
      this.logService.error(e);
      return this._count$.value;
    }
  }
}
