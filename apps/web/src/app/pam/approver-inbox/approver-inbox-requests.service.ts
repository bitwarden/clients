import { Injectable, inject } from "@angular/core";
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subscription,
  distinctUntilChanged,
  filter,
  from,
  map,
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
import { AccessRequestDetailsResponse, PamApiService } from "@bitwarden/pam";

import { isActionableInboxRequest } from "./inbox-request-filter";

/**
 * The single source of pending lease requests for the approver inbox while
 * {@link FeatureFlag.Pam} is on. Singleton (`providedIn: "root"`) so the one fetch
 * is shared by every consumer — the nav-badge slots and, on the page, the approver
 * inbox itself ({@link ApproverInboxService}) — instead of each issuing its own
 * `GET /access-requests/inbox`.
 *
 * Freshness combines push and local signals — no periodic polling:
 *
 * - The backend fires {@link NotificationType.RefreshApproverInbox} whenever
 *   any approver-visible row changes (new request, decision, lease revocation).
 * - {@link PamApiService.mutations$} fires after every locally-initiated mutation,
 *   so subscribers update immediately when this client creates, cancels, decides,
 *   or revokes — without waiting on the push round-trip.
 * - `syncCompleted` messages act as a recovery fallback when a push was missed
 *   (same pattern as the security-tasks badge).
 *
 * On any trigger — and on initial flag enable — the inbox is re-fetched and the
 * latest rows are multicast through {@link requests$} as raw responses; the page
 * applies its own sort and display-name resolution, while {@link count$} exposes the
 * actionable count for the nav badges.
 *
 * Errors are swallowed (the last good rows are kept) — a nav badge must never break
 * navigation.
 */
@Injectable({ providedIn: "root" })
export class ApproverInboxRequestsService {
  private readonly configService = inject(ConfigService);
  private readonly pamApiService = inject(PamApiService);
  private readonly notificationsService = inject(ServerNotificationsService);
  private readonly messageListener = inject(MessageListener);
  private readonly logService = inject(LogService);

  private readonly _requests$ = new BehaviorSubject<AccessRequestDetailsResponse[]>([]);
  /**
   * The latest pending inbox requests from the server, as raw responses. Shared by the nav badge
   * and the approver inbox page; each consumer applies its own actionable filter, sort, and
   * display-name resolution.
   */
  readonly requests$: Observable<AccessRequestDetailsResponse[]> = this._requests$.asObservable();

  /**
   * The nav-badge count: only requests that can still be actioned (a timed-out request is not
   * something the approver needs to decide, so it must not inflate the badge — matches the inbox
   * list filter). The nav slots echo this directly.
   */
  readonly count$: Observable<number> = this._requests$.pipe(
    map((rows) => countActionable(rows)),
    distinctUntilChanged(),
  );

  private subscription: Subscription | null = null;

  constructor() {
    this.subscription = this.configService
      .getFeatureFlag$(FeatureFlag.Pam)
      .pipe(
        switchMap((enabled) => (enabled ? this.refreshTriggers$() : this.empty$())),
        switchMap(() => from(this.fetch())),
      )
      .subscribe((rows) => this._requests$.next(rows));
  }

  /** Force an immediate refresh; used to reconcile after a decision settles. */
  async refresh(): Promise<void> {
    this._requests$.next(await this.fetch());
  }

  /** For test cleanup. */
  destroy(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  private refreshTriggers$(): Observable<unknown> {
    return merge(
      // Fire once immediately so consumers populate on flag enable.
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

  private empty$(): Observable<never> {
    // Reset the rows and skip the fetch when the flag is off.
    this._requests$.next([]);
    return EMPTY;
  }

  private async fetch(): Promise<AccessRequestDetailsResponse[]> {
    try {
      return await this.pamApiService.listInboxRequests();
    } catch (e) {
      this.logService.error(e);
      return this._requests$.value;
    }
  }
}

function countActionable(rows: AccessRequestDetailsResponse[]): number {
  const now = new Date();
  return rows.filter((row) => isActionableInboxRequest(row, now)).length;
}
