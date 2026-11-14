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

import { WindowMain } from "../../main/window.main";

// Matches DefaultVaultTimeoutService's check interval.
const CheckIntervalMs = 10 * 1000;

/**
 * Enforces vault timeout in main while the renderer is destroyed.
 *
 * Main owns the unlocked session, but the renderer runs the timeout checks. Without a renderer,
 * an unlocked vault would never time out. Main takes over only while the renderer is gone: running
 * both would lock twice.
 *
 * Only locking runs here. Logout cleans up through the renderer, so accounts that log out on
 * timeout keep the renderer alive instead (see {@link logoutOnTimeout}).
 *
 * ```
 *  every 10s ──────────────┐
 *  sleep / lock / idle ────┼─▶ renderer destroyed? ─ yes ─▶ lock timed-out accounts
 *                          │                        no ──▶ renderer handles it
 * ```
 */
export class HeadlessVaultTimeoutMain {
  private logoutAction = false;
  private subscription?: Subscription;
  private interval?: NodeJS.Timeout;

  constructor(
    private readonly windowMain: WindowMain,
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
      if (!this.windowMain.rendererDestroyed) {
        return;
      }

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
    if (!this.windowMain.rendererDestroyed) {
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
