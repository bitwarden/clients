import {
  concatMap,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  merge,
  Observable,
  of,
  Subscription,
  switchMap,
} from "rxjs";

import { BrowserTaskSchedulerService } from "@bitwarden/browser/platform/services/abstractions/browser-task-scheduler.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { NotificationType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { ScheduledTaskNames } from "@bitwarden/common/platform/scheduling";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import type { AccessLeaseView } from "@bitwarden/sdk-internal";

import { PAM_REFRESH_LEASES } from "../lease-messages";
import {
  isLeaseLive,
  LEASED_CIPHERS,
  LeasedCipherEntry,
  liveLeasedCiphers,
} from "../leased-cipher.state";

/**
 * Keeps an encrypted full copy of each cipher the user holds a live lease on, for the
 * background's autofill surfaces and the popup to join. Background only.
 */
export class PamLeaseRefreshService {
  private expiryTimer?: Subscription;
  private expiryQueue = Promise.resolve();

  constructor(
    private stateProvider: StateProvider,
    private authService: AuthService,
    private configService: ConfigService,
    private organizationService: OrganizationService,
    private sdkService: SdkService,
    private apiService: ApiService,
    private serverNotificationsService: ServerNotificationsService,
    private messageListener: MessageListener,
    private taskSchedulerService: BrowserTaskSchedulerService,
    private logService: LogService,
    /** Rebuilds the background's cipher caches (inline menu, context menu). */
    private leasedCiphersChanged: () => Promise<void>,
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
        switchMap((userIds) => merge(...userIds.map((userId) => this.refreshes$(userId)))),
      )
      .subscribe();
  }

  /** Re-reads the user's leases and stores a full copy of each newly leased cipher. */
  async refresh(userId: UserId): Promise<void> {
    try {
      const stored = (await firstValueFrom(this.leaseState(userId).state$))?.leases ?? {};
      const leases = (await this.allowed(userId)) ? await this.reconcile(userId, stored) : null;
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
      if (!sameKeys(stored, leases ?? {})) {
        await this.leasedCiphersChanged();
      }
      await this.scheduleExpiry();
    } catch (error) {
      this.logService.error(`[PAM] Failed to refresh leased ciphers: ${error}`);
    }
  }

  /** Refreshes at once too, since a worker start or an unlock may have missed a push. */
  private refreshes$(userId: UserId): Observable<void> {
    return merge(
      of(null),
      this.serverNotificationsService.notifications$.pipe(
        filter(
          ([notification, id]) =>
            notification.type === NotificationType.RefreshAccessRequest && id === userId,
        ),
      ),
      this.messageListener.allMessages$.pipe(
        filter(
          (msg) => msg.command === "syncCompleted" && !!msg.successfully && msg.userId === userId,
        ),
      ),
      this.messageListener
        .messages$(PAM_REFRESH_LEASES)
        .pipe(filter((msg) => msg.userId === userId)),
    ).pipe(concatMap(() => this.refresh(userId)));
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
  ): Promise<Record<string, LeasedCipherEntry>> {
    let leases: AccessLeaseView[];
    try {
      leases = await this.listMine(userId);
    } catch (error) {
      // Kept copies still lapse on their own `notAfter`.
      this.logService.error(`[PAM] Failed to list leases: ${error}`);
      return liveLeasedCiphers({ refreshedAt: 0, leases: stored }, Date.now());
    }

    const now = Date.now();
    const next: Record<string, LeasedCipherEntry> = {};
    for (const lease of leases) {
      if (lease.status !== "active" || !isLeaseLive(lease.notAfter, now)) {
        continue;
      }
      const cipherId = uuidAsString(lease.cipherId);
      const leaseId = uuidAsString(lease.id);
      const held = stored[cipherId];
      if (held?.leaseId === leaseId && held.notAfter === lease.notAfter) {
        next[cipherId] = held;
        continue;
      }
      const cipher = await this.fetchFullCopy(cipherId);
      if (cipher != null) {
        next[cipherId] = { leaseId, notAfter: lease.notAfter, cipher };
      }
    }
    return next;
  }

  private listMine(userId: UserId): Promise<AccessLeaseView[]> {
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().leases().list_mine();
        }),
      ),
    );
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

  private async pruneLapsed(): Promise<void> {
    try {
      const now = Date.now();
      let pruned = false;
      for (const userId of await this.userIds()) {
        const state = await firstValueFrom(this.leaseState(userId).state$);
        if (state != null && !sameKeys(state.leases, liveLeasedCiphers(state, now))) {
          await this.leaseState(userId).update(
            (current) => current && { ...current, leases: liveLeasedCiphers(current, now) },
          );
          pruned = true;
        }
      }
      if (pruned) {
        await this.leasedCiphersChanged();
      }
      await this.scheduleExpiry();
    } catch (error) {
      this.logService.error(`[PAM] Failed to prune lapsed leases: ${error}`);
    }
  }

  /** Serialised, so a slower reschedule cannot replace a newer one. */
  private scheduleExpiry(): Promise<void> {
    this.expiryQueue = this.expiryQueue
      .then(() => this.rescheduleExpiry())
      .catch((error) => this.logService.error(`[PAM] Failed to schedule lease expiry: ${error}`));
    return this.expiryQueue;
  }

  private async rescheduleExpiry(): Promise<void> {
    const now = Date.now();
    const states = await Promise.all(
      (await this.userIds()).map((userId) => firstValueFrom(this.leaseState(userId).state$)),
    );
    const ends = states
      .flatMap((state) => Object.values(liveLeasedCiphers(state, now)))
      .map((entry) => Date.parse(entry.notAfter));

    this.expiryTimer?.unsubscribe();
    // Also clears an alarm left by an earlier worker, which `setTimeout` would keep instead.
    await this.taskSchedulerService.clearScheduledAlarm(ScheduledTaskNames.pamLeaseExpiry);
    this.expiryTimer =
      ends.length === 0
        ? undefined
        : this.taskSchedulerService.setTimeout(
            ScheduledTaskNames.pamLeaseExpiry,
            Math.min(...ends) - now,
          );
  }

  private async userIds(): Promise<UserId[]> {
    return Object.keys(await firstValueFrom(this.authService.authStatuses$)) as UserId[];
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

function sameKeys(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a);
  return aKeys.length === Object.keys(b).length && aKeys.every((key) => key in b);
}
