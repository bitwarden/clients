import {
  combineLatest,
  concatMap,
  defaultIfEmpty,
  defer,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  merge,
  Observable,
  of,
  retry,
  skip,
  Subscription,
  switchMap,
} from "rxjs";

// Deep imports: the `pam` barrel pulls Angular components into the worker bundle.
import { AccessLeaseSdkService } from "@bitwarden/bit-common/pam/abstractions/access-lease-sdk.service";
import { isLeaseLive } from "@bitwarden/bit-common/pam/helpers/lease-liveness";
import { BrowserTaskSchedulerService } from "@bitwarden/browser/platform/services/abstractions/browser-task-scheduler.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { NotificationType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { SyncCipherNotification } from "@bitwarden/common/models/response/notification.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { ScheduledTaskNames } from "@bitwarden/common/platform/scheduling";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { StateProvider } from "@bitwarden/common/platform/state";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import type { AccessLeaseView } from "@bitwarden/sdk-internal";

import { PAM_REFRESH_LEASES } from "../lease-messages";
import { LEASED_CIPHERS, LeasedCipherEntry, liveLeasedCiphers } from "../leased-cipher.state";

type RefreshRequest = { refetch?: string; onlyIfHeld?: boolean };

/** One more try after a failed lease list, so a revocation push is not lost to it. */
const LIST_RETRY_MS = 30_000;

/**
 * Keeps an encrypted full copy of each cipher the user holds a live lease on, for the
 * background's autofill surfaces and the popup to join. Background only.
 */
export class PamLeaseRefreshService {
  private expiryTimer?: Subscription;

  constructor(
    private stateProvider: StateProvider,
    private authService: AuthService,
    private configService: ConfigService,
    private organizationService: OrganizationService,
    private accessLeaseSdkService: AccessLeaseSdkService,
    private apiService: ApiService,
    private serverNotificationsService: ServerNotificationsService,
    private syncService: SyncService,
    private messageListener: MessageListener,
    private taskSchedulerService: BrowserTaskSchedulerService,
    private logService: LogService,
  ) {
    // Registered during construction, so an alarm that wakes the worker finds its handler.
    this.taskSchedulerService.registerTaskHandler(ScheduledTaskNames.pamLeaseExpiry, () =>
      this.pruneLapsed(),
    );
  }

  start(): Subscription {
    return this.authService.authStatuses$
      .pipe(
        map(unlockedUserIds),
        distinctUntilChanged((a, b) => a.join() === b.join()),
        switchMap((userIds) =>
          merge(this.expiryAlarm$(userIds), ...userIds.map((userId) => this.refreshes$(userId))),
        ),
      )
      .subscribe();
  }

  /**
   * Re-reads the user's leases and stores a full copy of each newly leased cipher. `refetch` also
   * re-fetches that cipher's copy; with `onlyIfHeld`, nothing happens when no copy is held.
   */
  async refresh(userId: UserId, refetch?: string, onlyIfHeld = false): Promise<void> {
    try {
      const stored = (await firstValueFrom(this.leaseState(userId).state$))?.leases ?? {};
      if (onlyIfHeld && refetch != null && !(refetch in stored)) {
        return;
      }
      const leases = (await this.allowed(userId))
        ? await this.reconcile(userId, stored, refetch)
        : null;
      if (leases == null && Object.keys(stored).length === 0) {
        return;
      }

      // A lock clears this state; writing after it would outlive the lock.
      const status = await firstValueFrom(this.authService.authStatusFor$(userId));
      if (status !== AuthenticationStatus.Unlocked) {
        return;
      }

      await this.leaseState(userId).update(() =>
        leases == null ? null : { refreshedAt: Date.now(), leases },
      );
    } catch (error) {
      this.logService.error(`[PAM] Failed to refresh leased ciphers: ${error}`);
    }
  }

  /** Refreshes at once too, since a worker start or an unlock may have missed a push. */
  private refreshes$(userId: UserId): Observable<void> {
    const notifications$ = this.serverNotificationsService.notifications$.pipe(
      filter(([, id]) => id === userId),
      map(([notification]) => notification),
    );
    return merge(
      merge(
        of(null),
        notifications$.pipe(filter((n) => n.type === NotificationType.RefreshAccessRequest)),
        // Full syncs only; `syncCompleted` also follows each single-cipher push.
        this.syncService.lastSync$(userId).pipe(
          map((date) => date?.getTime()),
          distinctUntilChanged(),
          skip(1),
        ),
      ).pipe(map((): RefreshRequest => ({}))),
      this.messageListener.messages$(PAM_REFRESH_LEASES).pipe(
        filter((msg) => msg.userId === userId),
        map((msg): RefreshRequest => ({ refetch: msg.cipherId })),
      ),
      // Core sync keeps the restricted row (PAM-318), so an edit never reaches the held copy.
      notifications$.pipe(
        filter((n) => n.type === NotificationType.SyncCipherUpdate),
        map((n): RefreshRequest => ({
          refetch: (n.payload as SyncCipherNotification).id,
          onlyIfHeld: true,
        })),
      ),
    ).pipe(concatMap(({ refetch, onlyIfHeld }) => this.refresh(userId, refetch, onlyIfHeld)));
  }

  /** Backstop alarm at the earliest lease end, which wakes the worker to prune session storage. */
  private expiryAlarm$(userIds: UserId[]): Observable<void> {
    return combineLatest(userIds.map((userId) => this.leaseState(userId).state$)).pipe(
      defaultIfEmpty([]),
      map((states) => {
        const now = Date.now();
        const ends = states
          .flatMap((state) => Object.values(liveLeasedCiphers(state?.leases, now)))
          .map((entry) => Date.parse(entry.notAfter));
        return ends.length === 0 ? null : Math.min(...ends);
      }),
      distinctUntilChanged(),
      concatMap(async (end) => {
        try {
          this.expiryTimer?.unsubscribe();
          // Also clears an alarm left by an earlier worker, which `setTimeout` would keep instead.
          await this.taskSchedulerService.clearScheduledAlarm(ScheduledTaskNames.pamLeaseExpiry);
          this.expiryTimer =
            end == null
              ? undefined
              : this.taskSchedulerService.setTimeout(
                  ScheduledTaskNames.pamLeaseExpiry,
                  end - Date.now(),
                );
        } catch (error) {
          this.logService.error(`[PAM] Failed to schedule lease expiry: ${error}`);
        }
      }),
    );
  }

  private async allowed(userId: UserId): Promise<boolean> {
    const [flag, organizations] = await Promise.all([
      firstValueFrom(this.configService.userCachedFeatureFlag$(FeatureFlag.Pam, userId)),
      firstValueFrom(this.organizationService.organizations$(userId)),
    ]);
    return flag && organizations.some((organization) => organization.canAccessPrivilegedAccess);
  }

  private async reconcile(
    userId: UserId,
    stored: Record<string, LeasedCipherEntry>,
    refetch?: string,
  ): Promise<Record<string, LeasedCipherEntry>> {
    let leases: AccessLeaseView[];
    try {
      leases = await firstValueFrom(
        defer(() => this.accessLeaseSdkService.listMyLeases(userId)).pipe(
          retry({ count: 1, delay: LIST_RETRY_MS }),
        ),
      );
    } catch {
      // Kept copies still lapse on their own `notAfter`.
      return liveLeasedCiphers(stored, Date.now());
    }

    const now = Date.now();
    const entries = await Promise.all(
      leases
        .filter((lease) => lease.status === "active" && isLeaseLive(lease, now))
        .map(async (lease): Promise<[string, LeasedCipherEntry] | null> => {
          const cipherId = uuidAsString(lease.cipherId);
          const leaseId = uuidAsString(lease.id);
          const held = stored[cipherId];
          if (
            cipherId !== refetch &&
            held?.leaseId === leaseId &&
            held.notAfter === lease.notAfter
          ) {
            return [cipherId, held];
          }
          const cipher = await this.fetchFullCopy(cipherId);
          return cipher && [cipherId, { leaseId, notAfter: lease.notAfter, cipher }];
        }),
    );
    return Object.fromEntries(entries.filter((entry) => entry != null));
  }

  /** A still-partial response means the lease lapsed after the list read. */
  private async fetchFullCopy(cipherId: string): Promise<CipherData | null> {
    try {
      const cipher = new CipherData(await this.apiService.getFullCipherDetails(cipherId));
      return cipher.partialData == null ? cipher : null;
    } catch (error) {
      this.logService.error(`[PAM] Failed to fetch a leased cipher: ${error}`);
      return null;
    }
  }

  /** Drops lapsed copies from session storage; `start`'s streams then reschedule. */
  private async pruneLapsed(): Promise<void> {
    try {
      const now = Date.now();
      const userIds = Object.keys(await firstValueFrom(this.authService.authStatuses$)) as UserId[];
      for (const userId of userIds) {
        await this.leaseState(userId).update(
          (state) => state && { ...state, leases: liveLeasedCiphers(state.leases, now) },
          {
            shouldUpdate: (state) =>
              Object.values(state?.leases ?? {}).some((entry) => !isLeaseLive(entry, now)),
          },
        );
      }
    } catch (error) {
      this.logService.error(`[PAM] Failed to prune lapsed leases: ${error}`);
    }
  }

  private leaseState(userId: UserId) {
    return this.stateProvider.getUser(userId, LEASED_CIPHERS);
  }
}

function unlockedUserIds(statuses: Record<UserId, AuthenticationStatus>): UserId[] {
  return (Object.keys(statuses ?? {}) as UserId[])
    .filter((userId) => statuses[userId] === AuthenticationStatus.Unlocked)
    .sort();
}
