import {
  catchError,
  combineLatest,
  concatMap,
  distinctUntilChanged,
  EMPTY,
  finalize,
  firstValueFrom,
  from,
  map,
  merge,
  Observable,
  of,
  scan,
  Subject,
  Subscription,
  switchMap,
} from "rxjs";

import {
  AccessEventService,
  AccessLeaseSdkService,
  AccessRequestSdkService,
  ApprovalSdkService,
  diffPamState,
  nextLeaseBoundaryMs,
  PamNotificationInput,
  PamNotificationSink,
  PamNotificationSnapshot,
} from "@bitwarden/bit-pam";
import { ApprovalPrivilegeService } from "@bitwarden/bit-pam-components";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";

import { PamNotificationStateService } from "./pam-notification-state.service";

/** Longer timer delays overflow and fire at once. */
const MAX_TIMER_MS = 2 ** 31 - 1;
/** Past the boundary, so the re-read lands on the far side of it. */
const LAPSE_SLACK_MS = 1000;
/** How long to wait before re-reading leases after a failed read. */
const LEASE_RETRY_MS = 60 * 1000;
/** Marks a user whose snapshot this window has already seeded, so a reload can resume from it. */
const SEEDED_KEY_PREFIX = "pamNotifierSeeded:";

/** `approver` is whether the last read could list the inbox; `undefined` before the first. */
type Session = { active: boolean; approver?: boolean };

/**
 * Raises system notifications for the active user's access requests: a request awaiting their
 * approval, a decision on one of theirs, and a lease ending or ended.
 *
 * Each server push (and each lease boundary, which no push announces) re-reads the inbox, own
 * requests and leases, one read at a time, and diffs them against the last snapshot. Reading and
 * snapshotting continue while the toggle is off or the window is in front, so turning either back
 * on never announces a backlog; only the notification is withheld. Nothing is read while the flag
 * is off, no organization uses PAM, or the user is locked or logged out.
 *
 * The first read after login or unlock only seeds the snapshot, and so does the first read of a
 * cold start, since the stored snapshot may predate days of change. Only a renderer reload within
 * the same window session (marked in session storage, which a restart clears) resumes from the
 * stored snapshot.
 */
export class DesktopPamNotifier {
  private readonly lapse$ = new Subject<void>();
  private lapseTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private accountService: AccountService,
    private authService: AuthService,
    private configService: ConfigService,
    private organizationService: OrganizationService,
    private accessEventService: AccessEventService,
    private accessRequestSdkService: AccessRequestSdkService,
    private accessLeaseSdkService: AccessLeaseSdkService,
    private approvalSdkService: ApprovalSdkService,
    private approvalPrivilegeService: ApprovalPrivilegeService,
    private stateService: PamNotificationStateService,
    private sink: PamNotificationSink,
    private logService: LogService,
  ) {}

  /** Begins watching; unsubscribe to stop. */
  start(): Subscription {
    return this.accountService.activeAccount$
      .pipe(
        map((account) => account?.id ?? null),
        distinctUntilChanged(),
        switchMap((userId) => (userId == null ? EMPTY : this.session$(userId))),
      )
      .subscribe({ error: (error: unknown) => this.logService.error(error) });
  }

  private session$(userId: UserId): Observable<void> {
    return this.eligible$(userId).pipe(
      scan(
        (acc, eligible) => ({
          eligible,
          seed: eligible && acc.wasIneligible,
          wasIneligible: acc.wasIneligible || !eligible,
        }),
        // A window with no seeded marker starts as if it had just been locked.
        { eligible: false, seed: false, wasIneligible: !this.hasSeeded(userId) },
      ),
      switchMap(({ eligible, seed }) => (eligible ? this.watch$(userId, seed) : of(undefined))),
    );
  }

  private eligible$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.Pam),
      // PAM's desktop surface lives in the VFO1 layout; elsewhere there is nothing to open.
      this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
      this.organizationService
        .organizations$(userId)
        .pipe(map((organizations) => organizations.some((organization) => organization.usePam))),
      this.authService
        .authStatusFor$(userId)
        .pipe(map((status) => status === AuthenticationStatus.Unlocked)),
    ]).pipe(
      map((conditions) => conditions.every(Boolean)),
      distinctUntilChanged(),
    );
  }

  private watch$(userId: UserId, seed: boolean): Observable<void> {
    const session: Session = { active: true };
    let prev: PamNotificationSnapshot | null | undefined = seed ? null : undefined;
    return merge(
      of(undefined),
      this.accessEventService.accessChanged$(),
      this.accessEventService.approverInboxChanged$(),
      this.lapse$,
    ).pipe(
      concatMap(() =>
        from(
          (async () => {
            if (prev === undefined) {
              prev = await firstValueFrom(this.stateService.snapshot$(userId));
            }
            prev = await this.refresh(userId, prev, session);
          })(),
        ).pipe(
          catchError((error: unknown) => {
            this.logService.error(error);
            return EMPTY;
          }),
        ),
      ),
      finalize(() => {
        session.active = false;
        this.clearLapseTimer();
      }),
    );
  }

  private async refresh(
    userId: UserId,
    prev: PamNotificationSnapshot | null,
    session: Session,
  ): Promise<PamNotificationSnapshot | null> {
    const now = new Date();
    const canApprove = await firstValueFrom(this.approvalPrivilegeService.canApprove$);
    const [inbox, requests, leases] = await Promise.all([
      // Unread rather than empty, so a later gain of approver privilege isn't a whole backlog.
      canApprove ? this.read(() => this.approvalSdkService.listInbox()) : null,
      this.read(() => this.accessRequestSdkService.listMyAccessRequests()),
      this.read(() => this.accessLeaseSdkService.listMyLeases(userId)),
    ]);
    if (!session.active) {
      return prev;
    }

    const input: PamNotificationInput = { userId, inbox, requests, leases };
    const result = diffPamState(prev, input, now);
    const { snapshot } = result;
    // The inbox slice a non-approver carries is empty, not seen, so a gain of privilege makes the
    // whole backlog look new; that read only seeds the inbox.
    const gainedApprover = canApprove && session.approver === false;
    session.approver = canApprove;
    const events = gainedApprover
      ? result.events.filter((event) => event.kind !== "approvalRequested")
      : result.events;
    await this.stateService.setSnapshot(userId, snapshot);
    this.markSeeded(userId);
    if (leases != null) {
      const boundaryMs = nextLeaseBoundaryMs(snapshot, leases, now.getTime());
      this.scheduleLapse(
        boundaryMs == null ? undefined : boundaryMs - now.getTime() + LAPSE_SLACK_MS,
      );
    } else if (Object.keys(snapshot.leases).length > 0) {
      // The carried-over snapshot still holds open leases, but without their views no boundary
      // can be computed, so try the read again later rather than lose the timer.
      this.scheduleLapse(LEASE_RETRY_MS);
    }

    if (events.length > 0 && (await this.mayNotify()) && session.active) {
      await this.sink.notify(events);
    }
    return snapshot;
  }

  /** A failed read is `null`, so the diff carries that part of the snapshot over. */
  private async read<T>(read: () => Promise<T[]>): Promise<T[] | null> {
    try {
      return await read();
    } catch (error) {
      this.logService.error(error);
      return null;
    }
  }

  /** The toggle is on and the user isn't already looking at the app. */
  private async mayNotify(): Promise<boolean> {
    const enabled = await firstValueFrom(this.stateService.enabled$);
    if (!enabled) {
      return false;
    }
    const visible = await ipc.platform.isWindowVisible();
    return !(visible && document.hasFocus());
  }

  private hasSeeded(userId: UserId): boolean {
    try {
      return window.sessionStorage.getItem(SEEDED_KEY_PREFIX + userId) != null;
    } catch {
      return false;
    }
  }

  private markSeeded(userId: UserId): void {
    try {
      window.sessionStorage.setItem(SEEDED_KEY_PREFIX + userId, "1");
    } catch {
      // Without the marker a reload re-seeds, which only withholds notifications.
    }
  }

  private scheduleLapse(delayMs: number | undefined): void {
    this.clearLapseTimer();
    if (delayMs == null) {
      return;
    }
    const delay = Math.min(Math.max(delayMs, 0), MAX_TIMER_MS);
    this.lapseTimer = setTimeout(() => this.lapse$.next(), delay);
  }

  private clearLapseTimer(): void {
    if (this.lapseTimer != null) {
      clearTimeout(this.lapseTimer);
      this.lapseTimer = undefined;
    }
  }
}
