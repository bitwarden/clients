import { firstValueFrom, Observable, Subject } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { LockService } from "@bitwarden/auth/common";
import { ClientType } from "@bitwarden/client-type";
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { SharedUnlockLeader } from "@bitwarden/sdk-internal";
import { UnlockService } from "@bitwarden/unlock";

import { AccountService } from "../../auth/abstractions/account.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { IpcService } from "../../platform/ipc";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../types/guid";
import { VaultTimeoutSettingsService } from "../vault-timeout/abstractions/vault-timeout-settings.service";

import { JsSharedUnlockDriver } from "./shared-unlock-driver";
import { SharedUnlockLeaderService } from "./shared-unlock-leader.service";
import { SharedUnlockSettingsService } from "./shared-unlock-settings.service";
import { pollForUnlockEvents } from "./unlock-state-poll";

export class DefaultSharedUnlockLeaderService implements SharedUnlockLeaderService {
  private leader: SharedUnlockLeader | null = null;
  private _externalUnlock$ = new Subject<UserId>();
  readonly externalUnlock$: Observable<UserId> = this._externalUnlock$.asObservable();

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
    const sharedUnlockDriver = new JsSharedUnlockDriver(
      this.accountService,
      this.lockService,
      this.unlockService,
      this.keyService,
      this.platformUtilsService,
      this.vaultTimeoutSettingsService,
      this.environmentService,
      (userId) => this.enabled(userId),
      (userId) => this._externalUnlock$.next(userId),
    );

    this.leader = SharedUnlockLeader.try_new(this.ipcService.client, sharedUnlockDriver);
    await this.leader.start();
    this.lockService.registerOnLockAction(async (userId) => {
      if (!(await this.enabled(userId))) {
        return;
      }

      await this.leader!.handle_device_event({
        ManualLock: {
          user_id: asUuid(userId),
        },
      });
    });

    this.unlockService.registerOnUnlockAction(async (userId, userKey) =>
      this.onUnlock(userId, userKey),
    );
    pollForUnlockEvents(this.keyService, this.accountService, async (userId, userKey) =>
      this.onUnlock(userId, userKey),
    );
  }

  private async enabled(userId: UserId): Promise<boolean> {
    if (this.platformUtilsService.getClientType() === ClientType.Browser) {
      return await firstValueFrom(
        this.sharedUnlockSettingsService.allowSharingUnlockStateWithWeb$(userId),
      );
    } else {
      return true;
    }
  }

  private async onUnlock(userId: UserId, userKey: SymmetricCryptoKey): Promise<void> {
    if (!(await this.enabled(userId))) {
      return;
    }

    await this.leader!.handle_device_event({
      ManualUnlock: {
        user_id: asUuid(userId),
        user_key: userKey.toSdk(),
      },
    });
  }
}
