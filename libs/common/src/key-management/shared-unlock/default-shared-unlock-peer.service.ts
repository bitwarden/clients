import { SharedUnlockPeer } from "@bitwarden/sdk-internal";
import { LockService, LockSource, UnlockMethod, UnlockService } from "@bitwarden/unlock";

import { AccountService } from "../../auth/abstractions/account.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { IpcService } from "../../platform/ipc";
import { VaultTimeoutSettingsService } from "../vault-timeout/abstractions/vault-timeout-settings.service";

import { JsSharedUnlockDriver } from "./shared-unlock-driver";
import { SharedUnlockPeerService } from "./shared-unlock-peer.service";

export class DefaultSharedUnlockPeerService implements SharedUnlockPeerService {
  private peer: SharedUnlockPeer | null = null;

  constructor(
    private ipcService: IpcService,
    private accountService: AccountService,
    private lockService: LockService,
    private platformUtilsService: PlatformUtilsService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private environmentService: EnvironmentService,
    private unlockService: UnlockService,
  ) {}

  async start(): Promise<void> {
    const sharedUnlockDriver = new JsSharedUnlockDriver(
      this.accountService,
      this.lockService,
      this.unlockService,
      this.platformUtilsService,
      this.vaultTimeoutSettingsService,
      this.environmentService,
    );

    const peer = new SharedUnlockPeer(this.ipcService.client, sharedUnlockDriver);
    this.peer = peer;

    // Disabled until a follow-up sdk pr adds shared unlock peer destination settings
    return;

    await peer.start();

    this.lockService.registerOnLockAction(async (userId, source) => {
      // A peer locked us. Announcing it back would send it around the hierarchy again.
      if (source === LockSource.SharedUnlock) {
        return;
      }

      await peer.handle_device_event({
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

      await peer.handle_device_event({
        ManualUnlock: {
          user_id: asUuid(userId),
          user_key: userKey.toSdk(),
        },
      });
    });
  }
}
