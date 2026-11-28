import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogoutService } from "@bitwarden/common/auth/logout";
import {
  VaultTimeoutAction,
  VaultTimeoutService,
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { LockService, LockSource } from "@bitwarden/unlock";
import { UserId } from "@bitwarden/user-core";

import { BrowserApi } from "../platform/browser/browser-api";

import { SYSTEM_LOCKED } from "./idle.background.messages";

const IdleInterval = 60 * 5; // 5 minutes

export default class IdleBackground {
  private idle: typeof chrome.idle | typeof browser.idle | null;
  private idleTimer: null | number | NodeJS.Timeout = null;
  private idleState = "active";

  constructor(
    private vaultTimeoutService: VaultTimeoutService,
    private serverNotificationsService: ServerNotificationsService,
    private accountService: AccountService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private lockService: LockService,
    private logoutService: LogoutService,
    private authService: AuthService,
    private logService: LogService,
  ) {
    this.idle = chrome.idle || (browser != null ? browser.idle : null);
  }

  init() {
    BrowserApi.messageListener("idle.background", this.handleExtensionMessage);

    if (!this.idle) {
      return;
    }

    const idleHandler = (newState: string) => {
      if (newState === "active") {
        this.serverNotificationsService.reconnectFromActivity();
      } else {
        this.serverNotificationsService.disconnectFromInactivity();
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
        async (newState: `${chrome.idle.IdleState}` | browser.idle.IdleState) => {
          if (newState === "locked") {
            await this.onSystemLocked();
          }
        },
      );
    }
  }

  /**
   * Answers a system lock request once the session timeout is applied. It logs out or locks
   * accounts, so only extension pages may send it.
   */
  private handleExtensionMessage = (
    message: { command?: string },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean | void => {
    if (
      message?.command !== SYSTEM_LOCKED ||
      !BrowserApi.senderIsInternal(sender, this.logService)
    ) {
      return;
    }

    void this.answerSystemLocked(sendResponse);
    return true;
  };

  private async answerSystemLocked(sendResponse: (response?: unknown) => void): Promise<void> {
    let response: { error?: { message: string } } = {};
    try {
      await this.onSystemLocked();
    } catch (error) {
      response = { error: { message: error instanceof Error ? error.message : String(error) } };
    } finally {
      sendResponse(response);
    }
  }

  /**
   * Applies the "On system lock" session timeout to every account, as when the screen locks or
   * the screensaver activates.
   */
  private async onSystemLocked(): Promise<void> {
    const allUsers = await firstValueFrom(this.accountService.accounts$);
    for (const userId in allUsers) {
      // Skip if vault timeout is suppressed by shared unlock
      if (await this.vaultTimeoutSettingsService.isVaultTimeoutSuppressed(userId as UserId)) {
        continue;
      }
      // Logged out accounts stay in accounts$. Their timeout action must not be evaluated, as
      // without user decryption options it resolves to log out only and resets the stored action.
      const authStatus = await firstValueFrom(this.authService.authStatusFor$(userId as UserId));
      if (authStatus === AuthenticationStatus.LoggedOut) {
        continue;
      }

      const timeout = await firstValueFrom(
        this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(userId),
      );
      if (timeout === VaultTimeoutStringType.OnLocked) {
        const action = await firstValueFrom(
          this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(userId),
        );
        if (action === VaultTimeoutAction.LogOut) {
          await this.logoutService.logout(userId as UserId, "vaultTimeout");
        } else {
          await this.lockService.lock(userId as UserId, LockSource.VaultTimeout);
        }
      }
    }
  }

  private pollIdle(handler: (newState: string) => void) {
    if (this.idleTimer != null) {
      globalThis.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    void this.idle?.queryState(IdleInterval, (state: string) => {
      if (state !== this.idleState) {
        this.idleState = state;
        handler(state);
      }
      this.idleTimer = globalThis.setTimeout(() => this.pollIdle(handler), 5000);
    });
  }
}
