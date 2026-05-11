import { firstValueFrom } from "rxjs";

// eslint-disable-next-line import/no-cycle
import { LockService } from "@bitwarden/auth/common";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
// eslint-disable-next-line import/no-cycle
import { KeyService } from "@bitwarden/key-management";
import { SharedUnlockFollower } from "@bitwarden/sdk-internal";
import { UnlockService } from "@bitwarden/unlock";

import { AccountService } from "../../auth/abstractions/account.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { IpcService } from "../../platform/ipc";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../types/guid";
import { VaultTimeoutSettingsService } from "../vault-timeout/abstractions/vault-timeout-settings.service";

import { createSharedUnlockDriver } from "./shared-unlock-driver";
import { SharedUnlockFollowerService } from "./shared-unlock-follower.service";
import { SharedUnlockSettingsService } from "./shared-unlock-settings.service";

export class DefaultSharedUnlockFollowerService implements SharedUnlockFollowerService {
  constructor(
    private ipcService: IpcService,
    private accountService: AccountService,
    private lockService: LockService,
    private keyService: KeyService,
    private platformUtilsService: PlatformUtilsService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private environmentService: EnvironmentService,
    private sharedUnlockSettingsService: SharedUnlockSettingsService,
    private unlockService: UnlockService,
  ) {}

  async start(): Promise<void> {
    const sharedUnlockDriver = createSharedUnlockDriver(
      this.accountService,
      this.lockService,
      this.keyService,
      this.platformUtilsService,
      this.vaultTimeoutSettingsService,
      this.environmentService,
      this.sharedUnlockSettingsService,
    );

    const follower = SharedUnlockFollower.try_new(this.ipcService.client, sharedUnlockDriver);
    await follower.start();

    this.lockService.registerOnLockAction(async (userId) => {
      if (!(await this.enabled(userId))) {
        return;
      }

      await follower.handle_device_event({
        ManualLock: {
          user_id: asUuid(userId),
        },
      });
    });

    const previousUserKeys = new Map<UserId, SymmetricCryptoKey | null>();

    const announceUnlock = async (userId: UserId, userKey: SymmetricCryptoKey) => {
      if (!(await this.enabled(userId))) {
        return;
      }

      await follower.handle_device_event({
        ManualUnlock: {
          user_id: asUuid(userId),
          user_key: userKey.toSdk(),
        },
      });
      previousUserKeys.set(userId, userKey);
    };

    this.unlockService.registerOnUnlockAction(announceUnlock);

    // Polling fallback for unlock flows that do not yet route through UnlockService.
    // Once every unlock path goes through UnlockService, this interval can be removed.
    setInterval(async () => {
      const accounts = await firstValueFrom(this.accountService.accounts$);
      const accountIds = Object.keys(accounts) as UserId[];

      for (const accountId of accountIds) {
        const accountUserKey = await this.keyService.getUserKey(accountId);
        const previousUserKey = previousUserKeys.get(accountId) ?? null;

        if (previousUserKey == null && accountUserKey != null) {
          await announceUnlock(accountId, accountUserKey);
        } else {
          previousUserKeys.set(accountId, accountUserKey);
        }
      }

      for (const trackedUserId of previousUserKeys.keys()) {
        if (!accountIds.includes(trackedUserId)) {
          previousUserKeys.delete(trackedUserId);
        }
      }
    }, 100);
  }

  private async enabled(userId: UserId): Promise<boolean> {
    return await this.sharedUnlockSettingsService.allowSharingUnlockState(userId);
  }
}
