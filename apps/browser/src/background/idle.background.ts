import { firstValueFrom } from "rxjs";

import { NotificationsService } from "@bitwarden/common/abstractions/notifications.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { VaultTimeoutAction } from "@bitwarden/common/enums/vault-timeout-action.enum";
import { VaultTimeoutStringType } from "@bitwarden/common/types/vault-timeout.type";

const IdleInterval = 60 * 5; // 5 minutes

export default class IdleBackground {
  private idle: typeof chrome.idle | typeof browser.idle | null;
  private idleTimer: number | NodeJS.Timeout = null;
  private idleState = "active";

  constructor(
    private vaultTimeoutService: VaultTimeoutService,
    private notificationsService: NotificationsService,
    private accountService: AccountService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
  ) {
    this.idle = chrome.idle || (browser != null ? browser.idle : null);
  }

  async init() {
    if (!this.idle) {
      return;
    }

    const idleHandler = (newState: string) => {
      if (newState === "active") {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.notificationsService.reconnectFromActivity();
      } else {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.notificationsService.disconnectFromInactivity();
      }
    };
    if (this.idle.onStateChanged && this.idle.setDetectionInterval) {
      this.idle.setDetectionInterval(IdleInterval);
      this.idle.onStateChanged.addListener(idleHandler);
    } else {
      this.pollIdle(idleHandler);
    }

    if (this.idle.onStateChanged) {
      this.idle.onStateChanged.addListener(
        async (newState: chrome.idle.IdleState | browser.idle.IdleState) => {
          if (newState === "locked") {
            // Need to check if any of the current users have their timeout set to `onLocked`
            const allUsers = await firstValueFrom(this.accountService.accounts$);
            for (const userId in allUsers) {
              // If the screen is locked or the screensaver activates
              const timeout = await firstValueFrom(
                this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(userId),
              );
              if (timeout === VaultTimeoutStringType.OnLocked) {
                // On System Lock vault timeout option
                const action = await firstValueFrom(
                  this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(userId),
                );
                if (action === VaultTimeoutAction.LogOut) {
                  await this.vaultTimeoutService.logOut(userId);
                } else {
                  await this.vaultTimeoutService.lock(userId);
                }
              }
            }
          }
        },
      );
    }
  }

  private pollIdle(handler: (newState: string) => void) {
    if (this.idleTimer != null) {
      globalThis.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.idle.queryState(IdleInterval, (state: string) => {
      if (state !== this.idleState) {
        this.idleState = state;
        handler(state);
      }
      this.idleTimer = globalThis.setTimeout(() => this.pollIdle(handler), 5000);
    });
  }
}
