// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { combineLatest, concatMap, firstValueFrom, map } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LockService, LogoutService } from "@bitwarden/auth/common";

import { AccountService } from "../../../auth/abstractions/account.service";
import { AuthService } from "../../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { LogService } from "../../../platform/abstractions/log.service";
import { PlatformUtilsService } from "../../../platform/abstractions/platform-utils.service";
import { TaskSchedulerService, ScheduledTaskNames } from "../../../platform/scheduling";
import { UserId } from "../../../types/guid";
import { VaultTimeoutSettingsService } from "../abstractions/vault-timeout-settings.service";
import { VaultTimeoutService as VaultTimeoutServiceAbstraction } from "../abstractions/vault-timeout.service";
import { VaultTimeoutAction } from "../enums/vault-timeout-action.enum";

export class VaultTimeoutService implements VaultTimeoutServiceAbstraction {
  private inited = false;

  constructor(
    private accountService: AccountService,
    protected platformUtilsService: PlatformUtilsService,
    private authService: AuthService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private taskSchedulerService: TaskSchedulerService,
    protected logService: LogService,
    private lockService: LockService,
    private logoutService: LogoutService,
  ) {
    this.taskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.vaultTimeoutCheckInterval,
      () => this.checkVaultTimeout(),
    );
  }

  async init(checkOnInterval: boolean) {
    if (this.inited) {
      return;
    }

    this.inited = true;
    if (checkOnInterval) {
      this.startCheck();
    }
  }

  startCheck() {
    this.checkVaultTimeout().catch((error) => this.logService.error(error));
    this.taskSchedulerService.setInterval(
      ScheduledTaskNames.vaultTimeoutCheckInterval,
      10 * 1000, // check every 10 seconds
    );
  }

  async checkVaultTimeout(): Promise<void> {
    // Get whether or not the view is open a single time so it can be compared for each user
    const isViewOpen = await this.platformUtilsService.isPopupOpen();

    await firstValueFrom(
      combineLatest([
        this.accountService.activeAccount$,
        this.accountService.accountActivity$,
      ]).pipe(
        concatMap(async ([activeAccount, accountActivity]) => {
          const activeUserId = activeAccount?.id;
          for (const userIdString in accountActivity) {
            const userId = userIdString as UserId;
            if (
              userId != null &&
              (await this.shouldLock(userId, accountActivity[userId], activeUserId, isViewOpen))
            ) {
              await this.executeTimeoutAction(userId);
            }
          }
        }),
      ),
    );
  }

  async lock(userId?: UserId): Promise<void> {
    const lockingUserId =
      userId ?? (await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id))));
    await this.lockService.lock(lockingUserId);
  }

  private async shouldLock(
    userId: string,
    lastActive: Date,
    activeUserId: string,
    isViewOpen: boolean,
  ): Promise<boolean> {
    if (isViewOpen && userId === activeUserId) {
      // We know a view is open and this is the currently active user
      // which means they are likely looking at their vault
      // and they should not lock.
      return false;
    }

    const authStatus = await this.authService.getAuthStatus(userId);
    if (
      authStatus === AuthenticationStatus.Locked ||
      authStatus === AuthenticationStatus.LoggedOut
    ) {
      return false;
    }

    const vaultTimeout = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(userId),
    );

    if (typeof vaultTimeout === "string") {
      return false;
    }

    if (lastActive == null) {
      return false;
    }

    const vaultTimeoutSeconds = vaultTimeout * 60;
    const diffSeconds = (new Date().getTime() - lastActive.getTime()) / 1000;
    return diffSeconds >= vaultTimeoutSeconds;
  }

  private async executeTimeoutAction(userId: UserId): Promise<void> {
    const timeoutAction = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(userId),
    );
    timeoutAction === VaultTimeoutAction.LogOut
      ? await this.logoutService.logout(userId, "vaultTimeout")
      : await this.lockService.lock(userId);
  }
}
