import { Injectable } from "@angular/core";
import { concatMap, firstValueFrom, timer } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { SyncedUnlockService } from "@bitwarden/common/key-management/synced-unlock/abstractions/synced-unlock.service";
import { VaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout/services/vault-timeout.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import {
  KeyService,
  SyncedUnlockStateCommands,
  SyncedUnlockStateServiceAbstraction,
} from "@bitwarden/key-management";

import { NativeMessagingBackground } from "../../background/nativeMessaging.background";

@Injectable()
export class BackgroundSyncedUnlockService extends SyncedUnlockService {
  constructor(
    private nativeMessagingBackground: () => NativeMessagingBackground,
    private logService: LogService,
    private keyService: KeyService,
    private accountService: AccountService,
    private authService: AuthService,
    private vaultTimeoutService: VaultTimeoutService,
    private syncedUnlockStateService: SyncedUnlockStateServiceAbstraction,
  ) {
    super();
    timer(0, 1000)
      .pipe(
        concatMap(async () => {
          const isConnected = await this.isConnected();
          // Needed to resolve dependency cycle
          this.vaultTimeoutService.setDesktopAppConnected(isConnected);
          if (isConnected) {
            if (!(await firstValueFrom(this.syncedUnlockStateService.syncedUnlockEnabled$))) {
              return;
            }

            try {
              const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
              if (activeAccount) {
                const desktopAccountStatus = await Promise.race([
                  this.getUserStatusFromDesktop(activeAccount.id),
                  new Promise((resolve) =>
                    setTimeout(() => resolve(AuthenticationStatus.Locked), 5000),
                  ),
                ]);
                const localAccountStatus = await firstValueFrom(
                  this.authService.authStatusFor$(activeAccount.id),
                );
                this.logService.info(
                  `Synced unlock: ${activeAccount.id} - Desktop: ${desktopAccountStatus} - Local: ${localAccountStatus}`,
                );
                if (
                  desktopAccountStatus === AuthenticationStatus.Locked &&
                  localAccountStatus === AuthenticationStatus.Unlocked
                ) {
                  await this.vaultTimeoutService.lock(activeAccount.id);
                }
                if (
                  desktopAccountStatus === AuthenticationStatus.Unlocked &&
                  localAccountStatus === AuthenticationStatus.Locked
                ) {
                  const userKey = await this.getUserKeyFromDesktop(activeAccount.id);
                  if (userKey) {
                    await this.keyService.setUserKey(userKey, activeAccount.id);
                  }
                }
              }
            } catch (e) {
              this.logService.error("Error in synced unlock check", e);
            }
          }
        }),
      )
      .subscribe();
  }

  async isConnected(): Promise<boolean> {
    return this.nativeMessagingBackground().connected;
  }

  async lock(userId: UserId): Promise<void> {
    await this.nativeMessagingBackground().callCommand({
      command: SyncedUnlockStateCommands.SendLockToDesktop,
      userId,
    });
  }

  async getUserKeyFromDesktop(userId: UserId): Promise<UserKey | null> {
    const res = await this.nativeMessagingBackground().callCommand({
      command: SyncedUnlockStateCommands.GetUserKeyFromDesktop,
      userId,
    });
    if (res == null) {
      return null;
    } else {
      return SymmetricCryptoKey.fromString(res.response) as UserKey;
    }
  }

  async getUserStatusFromDesktop(userId: UserId): Promise<AuthenticationStatus> {
    const res = await this.nativeMessagingBackground().callCommand({
      command: SyncedUnlockStateCommands.GetUserStatusFromDesktop,
      userId,
    });
    return res.response;
  }

  async focusDesktopApp(): Promise<void> {
    await this.nativeMessagingBackground().callCommand({
      command: SyncedUnlockStateCommands.FocusDesktopApp,
    });
  }
}
