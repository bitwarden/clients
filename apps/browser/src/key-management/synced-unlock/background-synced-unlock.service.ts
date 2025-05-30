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

const SYNC_INTERVAL = 1000; // 1 second
const TRUST_DENIED_TIMEOUT = 30000; // 30 seconds
const STATUS_TIMEOUT = 5000; // 5 seconds

@Injectable()
export class BackgroundSyncedUnlockService extends SyncedUnlockService {
  private hasTrustDenied = false;

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
    timer(0, SYNC_INTERVAL)
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
                    setTimeout(() => resolve(AuthenticationStatus.Locked), STATUS_TIMEOUT),
                  ),
                ]);
                const localAccountStatus = await firstValueFrom(
                  this.authService.authStatusFor$(activeAccount.id),
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
                  this.logService.info("Asking for user key from desktop");
                  const userKey = await this.getUserKeyFromDesktop(activeAccount.id);
                  if (userKey != null) {
                    await this.keyService.setUserKey(userKey, activeAccount.id);
                  } else {
                    this.hasTrustDenied = true;
                    // this means the user has denied access to the key on connection fingerprint verification
                    // Wait 30 seconds
                    await new Promise((resolve) => setTimeout(resolve, TRUST_DENIED_TIMEOUT));
                    this.hasTrustDenied = false;
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

  async isConnectionTrusted(): Promise<boolean> {
    return !this.hasTrustDenied && this.isConnected();
  }
}
