import { firstValueFrom } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { SharedUnlockPeer } from "@bitwarden/sdk-internal";
import { LockService, LockSource, UnlockMethod, UnlockService } from "@bitwarden/unlock";

import { AccountService } from "../../auth/abstractions/account.service";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { IpcService } from "../../platform/ipc";
import { UserId } from "../../types/guid";
import { VaultTimeoutSettingsService } from "../vault-timeout/abstractions/vault-timeout-settings.service";

import { JsSharedUnlockDriver } from "./shared-unlock-driver";
import { SharedUnlockPeerService } from "./shared-unlock-peer.service";
import { SharedUnlockSettingsService } from "./shared-unlock-settings.service";

export class DefaultSharedUnlockPeerService implements SharedUnlockPeerService {
  private peer: SharedUnlockPeer | null = null;

  constructor(
    private ipcService: IpcService,
    private accountService: AccountService,
    private lockService: LockService,
    private platformUtilsService: PlatformUtilsService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private environmentService: EnvironmentService,
    private sharedUnlockSettingsService: SharedUnlockSettingsService,
    private unlockService: UnlockService,
    private configService: ConfigService,
  ) {}

  async start(): Promise<void> {
    // Part 1 brings the peer online and nothing more: it joins IPC and answers the peers that
    // reach it, but this device announces nothing of its own until part 2 below.
    if (!(await this.configService.getFeatureFlag(FeatureFlag.SharedUnlockPart1))) {
      return;
    }

    const sharedUnlockDriver = new JsSharedUnlockDriver(
      this.accountService,
      this.lockService,
      this.unlockService,
      this.platformUtilsService,
      this.vaultTimeoutSettingsService,
      this.environmentService,
      (userId) => this.enabled(userId),
    );

    this.peer = new SharedUnlockPeer(this.ipcService.client, sharedUnlockDriver);
    await this.peer.start();

    // Part 2 adds the outbound half. Until it lands the peer only answers the devices that reach
    // it; this device's own lock and unlock events stay local.
    if (!(await this.configService.getFeatureFlag(FeatureFlag.SharedUnlockPart2))) {
      return;
    }

    this.lockService.registerOnLockAction(async (userId, source) => {
      // A peer locked us. Announcing it back would send it around the hierarchy again.
      if (source === LockSource.SharedUnlock) {
        return;
      }

      if (!(await this.enabled(userId))) {
        return;
      }

      await this.peer!.handle_device_event({
        ManualLock: {
          user_id: asUuid(userId),
        },
      });
    });

    this.unlockService.registerOnUnlockAction(async (userId, userKey, method) => {
      // A peer handed us this unlock. Announcing it back would send it around the hierarchy again.
      if (method === UnlockMethod.SharedUnlock) {
        return;
      }

      if (!(await this.enabled(userId))) {
        return;
      }

      await this.peer!.handle_device_event({
        ManualUnlock: {
          user_id: asUuid(userId),
          user_key: userKey.toSdk(),
        },
      });
    });
  }

  /**
   * Whether this device may participate in shared unlock for the given user.
   */
  private async enabled(userId: UserId): Promise<boolean> {
    if (await firstValueFrom(this.sharedUnlockSettingsService.unlockSharingDisabled$(userId))) {
      return false;
    }

    if (this.platformUtilsService.getClientType() !== ClientType.Browser) {
      return true;
    }

    const [withDesktop, withWeb] = await Promise.all([
      firstValueFrom(this.sharedUnlockSettingsService.allowSharingUnlockStateWithDesktop$(userId)),
      firstValueFrom(this.sharedUnlockSettingsService.allowSharingUnlockStateWithWeb$(userId)),
    ]);
    return withDesktop || withWeb;
  }
}
