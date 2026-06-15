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
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { PamApiService } from "@bitwarden/pam";

import { isActionableInboxRequest } from "./inbox-request-filter";

/**
 * Drives the nav-badge count of pending lease requests while
 * {@link FeatureFlag.Pam} is on. Singleton (`providedIn: "root"`) so the badge
 * survives across page navigations.
 *
 * Freshness combines push and local signals — no periodic polling:
 *
 * - The backend fires {@link NotificationType.RefreshApproverInbox} whenever
 *   any approver-visible row changes (new request, decision, lease revocation).
 * - {@link PamApiService.mutations$} fires after every locally-initiated
 *   mutation, so the badge updates immediately when this client creates,
 *   cancels, decides, or revokes — without waiting on the push round-trip.
 * - `syncCompleted` messages act as a recovery fallback when a push was
 *   missed (same pattern as the security-tasks badge).
 *
 * On any trigger — and on initial flag enable — we re-fetch the inbox and
 * take its length.
 *
 * Errors are swallowed — a nav badge must never break navigation.
 */
@Injectable({ providedIn: "root" })
export class ApproverInboxBadgeService {
  private readonly configService = inject(ConfigService);
  private readonly pamApiService = inject(PamApiService);
  private readonly notificationsService = inject(ServerNotificationsService);
  private readonly messageListener = inject(MessageListener);
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
      // Locally-initiated mutations (create / cancel / decide / revoke / …).
      this.pamApiService.mutations$,
      // Recovery fallback for pushes missed while disconnected.
      this.messageListener.allMessages$.pipe(filter((msg) => msg.command === "syncCompleted")),
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
      // Count only requests that can still be actioned; a timed-out request is
      // not something the approver needs to decide, so it must not inflate the
      // nav badge. Matches the inbox list filter.
      const now = new Date();
      return rows.filter((row) => isActionableInboxRequest(row, now)).length;
    } catch (e) {
      this.logService.error(e);
      return this._count$.value;
    }
  }
}
