// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { combineLatest, concatMap, filter, firstValueFrom, map, timeout } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LogoutReason } from "@bitwarden/auth/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { BiometricsService } from "@bitwarden/key-management";

import { AccountService } from "../../../auth/abstractions/account.service";
import { AuthService } from "../../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { LogService } from "../../../platform/abstractions/log.service";
import { MessagingService } from "../../../platform/abstractions/messaging.service";
import { PlatformUtilsService } from "../../../platform/abstractions/platform-utils.service";
import { StateService } from "../../../platform/abstractions/state.service";
import { TaskSchedulerService, ScheduledTaskNames } from "../../../platform/scheduling";
import { StateEventRunnerService } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { FolderService } from "../../../vault/abstractions/folder/folder.service.abstraction";
import { SearchService } from "../../../vault/abstractions/search.service";
import { InternalMasterPasswordServiceAbstraction } from "../../master-password/abstractions/master-password.service.abstraction";
import { VaultTimeoutSettingsService } from "../abstractions/vault-timeout-settings.service";
import { VaultTimeoutService as VaultTimeoutServiceAbstraction } from "../abstractions/vault-timeout.service";
import { VaultTimeoutAction } from "../enums/vault-timeout-action.enum";

export class VaultTimeoutService implements VaultTimeoutServiceAbstraction {
  private inited = false;

  constructor(
    private accountService: AccountService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private cipherService: CipherService,
    private folderService: FolderService,
    private collectionService: CollectionService,
    protected platformUtilsService: PlatformUtilsService,
    private messagingService: MessagingService,
    private searchService: SearchService,
    private stateService: StateService,
    private authService: AuthService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private stateEventRunnerService: StateEventRunnerService,
    private taskSchedulerService: TaskSchedulerService,
    protected logService: LogService,
    private biometricService: BiometricsService,
    private lockedCallback: (userId: UserId) => Promise<void> = null,
    private loggedOutCallback: (
      logoutReason: LogoutReason,
      userId?: string,
    ) => Promise<void> = null,
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
    const isViewOpen = await this.platformUtilsService.isViewOpen();

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
    await this.biometricService.setShouldAutopromptNow(false);

    const authed = await this.stateService.getIsAuthenticated({ userId: userId });
    if (!authed) {
      return;
    }

    const availableActions = await firstValueFrom(
      this.vaultTimeoutSettingsService.availableVaultTimeoutActions$(userId),
    );
    const supportsLock = availableActions.includes(VaultTimeoutAction.Lock);
    if (!supportsLock) {
      await this.logOut(userId);
    }

    const currentUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );

    const lockingUserId = userId ?? currentUserId;

    // HACK: Start listening for the transition of the locking user from something to the locked state.
    // This is very much a hack to ensure that the authentication status to retrievable right after
    // it does its work. Particularly the `lockedCallback` and `"locked"` message. Instead
    // lockedCallback should be deprecated and people should subscribe and react to `authStatusFor$` themselves.
    const lockPromise = firstValueFrom(
      this.authService.authStatusFor$(lockingUserId).pipe(
        filter((authStatus) => authStatus === AuthenticationStatus.Locked),
        timeout({
          first: 5_000,
          with: () => {
            throw new Error("The lock process did not complete in a reasonable amount of time.");
          },
        }),
      ),
    );

    await this.searchService.clearIndex(lockingUserId);

    await this.folderService.clearDecryptedFolderState(lockingUserId);
    await this.masterPasswordService.clearMasterKey(lockingUserId);

    await this.stateService.setUserKeyAutoUnlock(null, { userId: lockingUserId });

    await this.cipherService.clearCache(lockingUserId);

    await this.stateEventRunnerService.handleEvent("lock", lockingUserId);

    // HACK: Sit here and wait for the the auth status to transition to `Locked`
    // to ensure the message and lockedCallback will get the correct status
    // if/when they call it.
    await lockPromise;

    this.messagingService.send("locked", { userId: lockingUserId });

    if (this.lockedCallback != null) {
      await this.lockedCallback(lockingUserId);
    }
  }

  async logOut(userId?: string): Promise<void> {
    if (this.loggedOutCallback != null) {
      await this.loggedOutCallback("vaultTimeout", userId);
    }
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
      ? await this.logOut(userId)
      : await this.lock(userId);
  }
}
