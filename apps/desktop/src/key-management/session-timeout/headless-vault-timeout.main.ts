import { combineLatest, firstValueFrom, map, of, Subscription, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  VaultTimeout,
  VaultTimeoutAction,
  VaultTimeoutService,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { LockService, LockSource } from "@bitwarden/unlock";

const CheckIntervalMs = 1 * 1000;

/**
 * Enforces vault timeout in main, so an unlocked vault still times out while the renderer is
 * destroyed, or does not exist yet.
 *
 * Only locking runs here. Logout cleans up through the renderer, so accounts that log out on
 * timeout keep the renderer alive instead (see {@link logoutOnTimeout}).
 *
 * ```
 *  every 1s ───────────────┐
 *  sleep / lock / idle ────┼─▶ flag enabled? ─ yes ─▶ lock timed-out accounts
 *                          │                 no  ──▶ renderer handles it
 * ```
 */
export class HeadlessVaultTimeoutMain {
  private logoutAction = false;
  private subscription?: Subscription;
  private interval?: NodeJS.Timeout;

  constructor(
    private readonly flagEnabled: boolean,
    private readonly vaultTimeoutService: VaultTimeoutService,
    private readonly vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private readonly accountService: AccountService,
    private readonly lockService: LockService,
    private readonly logService: LogService,
  ) {}

  /** Whether any account logs out on timeout. Read synchronously by the teardown guard. */
  get logoutOnTimeout(): boolean {
    return this.logoutAction;
  }

  init(): void {
    if (!this.flagEnabled) {
      return;
    }

    // Cache whether any account logs out on timeout, so the guard can read it synchronously.
    this.subscription = this.accountService.accounts$
      .pipe(
        switchMap((accounts) => {
          const userIds = Object.keys(accounts);
          if (userIds.length === 0) {
            return of([]);
          }
          return combineLatest(
            userIds.map((userId) =>
              this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(userId),
            ),
          );
        }),
        map((actions) => actions.includes(VaultTimeoutAction.LogOut)),
      )
      .subscribe((logout) => {
        this.logoutAction = logout;
      });

    this.interval = setInterval(() => {
      this.vaultTimeoutService.checkVaultTimeout().catch((e) => {
        this.logService.error("[Headless vault timeout] Check failed", e);
      });
    }, CheckIntervalMs);
  }

  dispose(): void {
    this.subscription?.unsubscribe();
    clearInterval(this.interval);
  }

  /** Locks every account whose timeout is the given system event, e.g. "onSleep". */
  async onSystemEvent(timeout: VaultTimeout): Promise<void> {
    if (!this.flagEnabled) {
      return;
    }

    const accounts = await firstValueFrom(this.accountService.accounts$);
    for (const userId of Object.keys(accounts) as UserId[]) {
      // Shared unlock can keep a vault unlocked past its timeout.
      if (await this.vaultTimeoutSettingsService.isVaultTimeoutSuppressed(userId)) {
        continue;
      }

      const userTimeout = await firstValueFrom(
        this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(userId),
      );
      if (userTimeout !== timeout) {
        continue;
      }

      await this.lockService.lock(userId, LockSource.VaultTimeout);
    }
  }
}
