import { combineLatest, filter, firstValueFrom, map, timeout } from "rxjs";

import { LogoutService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/process-reload";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SystemService } from "@bitwarden/common/platform/abstractions/system.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { BiometricsService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { StateEventRunnerService } from "@bitwarden/state";

import { LockSource } from "./lock-source.enum";

/** Callers batching multiple locks reload the process once, after the last lock. */
const SuppressProcessReload = true;
const PerformProcessReload = false;

export abstract class LockService {
  /**
   * Locks all accounts.
   * @param source What caused the lock
   */
  abstract lockAll(source: LockSource): Promise<void>;
  /**
   * Performs lock for a user.
   * @param userId The user id to lock
   * @param source What caused the lock
   */
  abstract lock(userId: UserId, source: LockSource): Promise<void>;

  abstract runPlatformOnLockActions(userId: UserId, source: LockSource): Promise<void>;
  /**
   * Registers an action to be run when a user is locked through this service.
   *
   * @param action Callback invoked after a lock with the user id and what caused the lock.
   */
  abstract registerOnLockAction(
    action: (userId: UserId, source: LockSource) => Promise<void>,
  ): void;
}

export class DefaultLockService implements LockService {
  private onLockActions: Array<(userId: UserId, source: LockSource) => Promise<void>> = [];

  constructor(
    private readonly accountService: AccountService,
    private readonly biometricService: BiometricsService,
    private readonly vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private readonly logoutService: LogoutService,
    private readonly messagingService: MessagingService,
    private readonly folderService: FolderService,
    private readonly stateEventRunnerService: StateEventRunnerService,
    private readonly cipherService: CipherService,
    private readonly authService: AuthService,
    private readonly systemService: SystemService,
    private readonly processReloadService: ProcessReloadServiceAbstraction,
    private readonly logService: LogService,
    private readonly keyService: KeyService,
  ) {}

  registerOnLockAction(action: (userId: UserId, source: LockSource) => Promise<void>): void {
    this.onLockActions.push(action);
  }

  async lockAll(source: LockSource) {
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

    // Process reload is suppressed for the individual locks and done once at the
    // end, so a reload cannot cut the remaining locks short.
    for (const otherAccount of accounts.otherAccounts) {
      await this.lockUser(otherAccount, source, SuppressProcessReload);
    }

    // Do the active account last in case we ever try to route the user on lock
    // that way this whole operation will be complete before that routing
    // could take place.
    if (accounts.activeAccount != null) {
      await this.lockUser(accounts.activeAccount, source, SuppressProcessReload);
    }

    // Wipe the current process to clear active secrets in memory.
    await this.processReloadService.reloadProcess();
  }

  async lock(userId: UserId, source: LockSource): Promise<void> {
    await this.lockUser(userId, source, PerformProcessReload);
  }

  private async lockUser(
    userId: UserId,
    source: LockSource,
    suppressProcessReload: boolean,
  ): Promise<void> {
    assertNonNullish(userId, "userId", "LockService");

    this.logService.info(`[LockService] Locking user ${userId}`);

    // If user already logged out, then skip locking
    if (
      (await firstValueFrom(this.authService.authStatusFor$(userId))) ===
      AuthenticationStatus.LoggedOut
    ) {
      return;
    }

    // If user cannot lock, then logout instead
    if (!(await this.vaultTimeoutSettingsService.canLock(userId))) {
      // Logout should perform the same steps
      await this.logoutService.logout(userId, "vaultTimeout");
      this.logService.info(`[LockService] User ${userId} cannot lock, logging out instead.`);
      return;
    }

    await this.wipeDecryptedState(userId);
    await this.waitForLockedStatus(userId);
    await this.systemService.clearPendingClipboard();
    await this.runPlatformOnLockActions(userId, source);

    this.logService.info(`[LockService] Locked user ${userId}`);

    // Subscribers navigate the client to the lock screen based on this lock message.
    // We need to disable auto-prompting as we are just entering a locked state now.
    await this.biometricService.setShouldAutopromptNow(false);
    this.messagingService.send("locked", { userId });

    if (suppressProcessReload) {
      return;
    }

    // Wipe the current process to clear active secrets in memory.
    await this.processReloadService.reloadProcess();
  }

  private async wipeDecryptedState(userId: UserId) {
    // Manually clear state
    //! DO NOT REMOVE folderService.clearDecryptedFolderState ! For more information see PM-25660
    await this.folderService.clearDecryptedFolderState(userId);
    await this.cipherService.clearCache(userId);
    // Clear CLI unlock state
    await this.keyService.clearStoredUserKey(userId);

    // This will clear ephemeral state such as the user's user key based on the key definition's clear-on
    await this.stateEventRunnerService.handleEvent("lock", userId);
  }

  private async waitForLockedStatus(userId: UserId): Promise<void> {
    // HACK: Start listening for the transition of the locking user from something to the locked state.
    // This is very much a hack to ensure that the authentication status to retrievable right after
    // it does its work. Particularly and `"locked"` message. Instead the message should be deprecated
    // and people should subscribe and react to `authStatusFor$` themselves.
    await firstValueFrom(
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
  }

  async runPlatformOnLockActions(userId: UserId, source: LockSource): Promise<void> {
    for (const action of this.onLockActions) {
      await action(userId, source);
    }
    // No platform specific actions to run for this platform.
    return;
  }
}
