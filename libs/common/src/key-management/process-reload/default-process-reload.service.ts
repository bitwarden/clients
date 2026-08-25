import { firstValueFrom, timeout } from "rxjs";

import { AccountService } from "../../auth/abstractions/account.service";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { getOptionalUserId } from "../../auth/services/account.service";
import { LogService } from "../../platform/abstractions/log.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { UserId } from "../../types/guid";
import { PinServiceAbstraction } from "../pin/pin.service.abstraction";
import { VaultTimeoutAction, VaultTimeoutSettingsService } from "../vault-timeout";

import { ProcessReloadServiceAbstraction } from "./process-reload.service";

/**
 * Safety timeout for state reads, so a hanging call cannot stop the process
 * reload from clearing memory.
 */
const STATE_READ_TIMEOUT_MS = 500;

export class DefaultProcessReloadService implements ProcessReloadServiceAbstraction {
  constructor(
    private pinService: PinServiceAbstraction,
    private messagingService: MessagingService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private accountService: AccountService,
    private logService: LogService,
    private authService: AuthService,
  ) {}

  async reloadProcess(): Promise<void> {
    if (await this.isAnyUserUnlocked()) {
      this.logService.info("[Process Reload Service] User unlocked, preventing process reload");
      return;
    }

    if (await this.isAnyPinInAfuMode()) {
      this.logService.info(
        "[Process Reload Service] Ephemeral pin active, preventing process reload",
      );
      return;
    }

    await this.performLogoutsForVaultTimeoutLogoutUsers();
    await this.performProcessReload();
  }

  private async isAnyUserUnlocked(): Promise<boolean> {
    const accounts = await firstValueFrom(this.accountService.accounts$);

    for (const userId of Object.keys(accounts ?? {})) {
      const status = await this.authService.getAuthStatus(userId as UserId);
      if (status === AuthenticationStatus.Unlocked) {
        return true;
      }
    }

    return false;
  }

  /** An ephemeral (after-first-unlock) pin cannot survive a process reload, so it blocks one. */
  private async isAnyPinInAfuMode(): Promise<boolean> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getOptionalUserId));
    if (userId == null) {
      return false;
    }

    return (await this.pinService.getPinLockType(userId)) === "AfterFirstUnlock";
  }

  /**
   * The active user is logged out on reload when their vault timeout action is
   * log out, so switch to the next account up before reloading.
   */
  private async performLogoutsForVaultTimeoutLogoutUsers(): Promise<void> {
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId, timeout(STATE_READ_TIMEOUT_MS)),
    );
    if (activeUserId == null) {
      return;
    }

    const timeoutAction = await firstValueFrom(
      this.vaultTimeoutSettingsService
        .getVaultTimeoutActionByUserId$(activeUserId)
        .pipe(timeout(STATE_READ_TIMEOUT_MS)),
    );
    if (timeoutAction !== VaultTimeoutAction.LogOut) {
      return;
    }

    const nextUser = await firstValueFrom(
      this.accountService.nextUpAccount$.pipe(getOptionalUserId),
    );
    await this.accountService.switchAccount(nextUser);
  }

  /**
   * Wipes the process. Clients that cannot reload from the "reloadProcess" message alone
   * override this to add their own teardown.
   */
  protected async performProcessReload(): Promise<void> {
    this.messagingService.send("reloadProcess");
  }
}
