import { combineLatest, filter, firstValueFrom, map, timeout } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/abstractions/process-reload.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  VaultTimeoutSettingsService,
  VaultTimeoutAction,
} from "@bitwarden/common/key-management/vault-timeout";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SystemService } from "@bitwarden/common/platform/abstractions/system.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { BiometricsService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { StateService, StateEventRunnerService } from "@bitwarden/state";

import { LogoutService } from "../../abstractions";

export abstract class LockService {
  /**
   * Locks all accounts.
   */
  abstract lockAll(): Promise<void>;
  /**
   * Performs lock for a user.
   * @param userId The user id to lock
   */
  abstract lock(userId: UserId): Promise<void>;
}

export class DefaultLockService implements LockService {
  constructor(
    private readonly accountService: AccountService,
    private readonly biometricService: BiometricsService,
    private readonly tokenService: TokenService,
    private readonly vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private readonly logoutService: LogoutService,
    private readonly messagingService: MessagingService,
    private readonly searchService: SearchService,
    private readonly folderService: FolderService,
    private readonly masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private readonly stateService: StateService,
    private readonly stateEventRunnerService: StateEventRunnerService,
    private readonly cipherService: CipherService,
    private readonly authService: AuthService,
    private readonly systemService: SystemService,
    private readonly processReloadService: ProcessReloadServiceAbstraction,
    private readonly logService: LogService,
    private readonly keyService: KeyService,
  ) {}

  async lockAll() {
    const accounts = await firstValueFrom(
      combineLatest([this.accountService.activeAccount$, this.accountService.accounts$]).pipe(
        map(([activeAccount, accounts]) => {
          const otherAccounts = Object.keys(accounts) as UserId[];

          if (activeAccount == null) {
            return { activeAccount: null, otherAccounts: otherAccounts };
          }

          return {
            activeAccount: activeAccount.id,
            otherAccounts: otherAccounts.filter((accountId) => accountId !== activeAccount.id),
          };
        }),
      ),
    );

    for (const otherAccount of accounts.otherAccounts) {
      await this.lock(otherAccount);
    }

    // Do the active account last in case we ever try to route the user on lock
    // that way this whole operation will be complete before that routing
    // could take place.
    if (accounts.activeAccount != null) {
      await this.lock(accounts.activeAccount);
    }
  }

  async lock(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId", "LockService");
    this.logService.info(`[LockService] Locking user ${userId}`);

    await this.biometricService.setShouldAutopromptNow(false);
    const authed = await firstValueFrom(this.tokenService.hasAccessToken$(userId));
    if (!authed) {
      return;
    }

    const availableActions = await firstValueFrom(
      this.vaultTimeoutSettingsService.availableVaultTimeoutActions$(userId),
    );
    const supportsLock = availableActions.includes(VaultTimeoutAction.Lock);
    if (!supportsLock) {
      await this.logoutService.logout(userId, "vaultTimeout");
    }

    // HACK: Start listening for the transition of the locking user from something to the locked state.
    // This is very much a hack to ensure that the authentication status to retrievable right after
    // it does its work. Particularly the `lockedCallback` and `"locked"` message. Instead
    // lockedCallback should be deprecated and people should subscribe and react to `authStatusFor$` themselves.
    const lockPromise = firstValueFrom(
      this.authService.authStatusFor$(userId).pipe(
        filter((authStatus) => authStatus === AuthenticationStatus.Locked),
        timeout({
          first: 5_000,
          with: () => {
            throw new Error("The lock process did not complete in a reasonable amount of time.");
          },
        }),
      ),
    );

    // Manual clearing of state
    await this.searchService.clearIndex(userId);
    // ! DO NOT REMOVE folderService.clearDecryptedFolderState ! For more information see PM-25660
    await this.folderService.clearDecryptedFolderState(userId);
    await this.masterPasswordService.clearMasterKey(userId);
    await this.stateService.setUserKeyAutoUnlock(null, { userId });
    await this.cipherService.clearCache(userId);
    // Clear CLI unlock state
    await this.keyService.clearStoredUserKey(KeySuffixOptions.Auto, userId);

    // System clipboard clearing
    await this.systemService.clearPendingClipboard();

    // This will clear ephemeral state such as the user's user key
    await this.stateEventRunnerService.handleEvent("lock", userId);

    // HACK: Sit here and wait for the the auth status to transition to `Locked`
    // to ensure the message and lockedCallback will get the correct status
    // if/when they call it.
    await lockPromise;
    this.logService.info(`[LockService] Locked user ${userId}`);

    // Subscribers navigate the client to the lock screen based on this lock message
    this.messagingService.send("locked", { userId });

    // Wipe the current process to clear active secrets in memory.
    await this.biometricService.setShouldAutopromptNow(false);
    await this.processReloadService.startProcessReload();
  }
}
