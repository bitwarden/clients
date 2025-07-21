import { combineLatest, timer } from "rxjs";
import { filter, concatMap } from "rxjs/operators";

import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import {
  BiometricsService,
  BiometricsCommands,
  BiometricsStatus,
  KeyService,
  BiometricStateService,
} from "@bitwarden/key-management";

import { NativeMessagingBackground } from "../../background/nativeMessaging.background";
import { BrowserApi } from "../../platform/browser/browser-api";

export class BackgroundBrowserBiometricsService extends BiometricsService {
  BACKGROUND_POLLING_INTERVAL = 30_000;

  constructor(
    private nativeMessagingBackground: () => NativeMessagingBackground,
    private logService: LogService,
    private keyService: KeyService,
    private biometricStateService: BiometricStateService,
    private messagingService: MessagingService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
  ) {
    super();
    // Always connect to the native messaging background if biometrics are enabled, not just when it is used
    // so that there is no wait when used.
    const biometricsEnabled = this.biometricStateService.biometricUnlockEnabled$;

    combineLatest([timer(0, this.BACKGROUND_POLLING_INTERVAL), biometricsEnabled])
      .pipe(
        filter(([_, enabled]) => enabled),
        filter(([_]) => !this.nativeMessagingBackground().connected),
        concatMap(async () => {
          try {
            await this.nativeMessagingBackground().connect();
            await this.getBiometricsStatus();
          } catch {
            // Ignore
          }
        }),
      )
      .subscribe();
  }

  async authenticateWithBiometrics(): Promise<boolean> {
    try {
      await this.ensureConnected();

      const response = await this.nativeMessagingBackground().callCommand({
        command: BiometricsCommands.AuthenticateWithBiometrics,
      });
      return response.response;
    } catch (e) {
      this.logService.info("Biometric authentication failed", e);
      return false;
    }
  }

  async getBiometricsStatus(): Promise<BiometricsStatus> {
    if (!(await BrowserApi.permissionsGranted(["nativeMessaging"]))) {
      return BiometricsStatus.NativeMessagingPermissionMissing;
    }

    try {
      const response = await this.nativeMessagingBackground().callCommand({
        command: BiometricsCommands.GetBiometricsStatus,
      });

      if (response.response) {
        return response.response;
      }
      return BiometricsStatus.Available;
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return BiometricsStatus.DesktopDisconnected;
    }
  }

  async unlockWithBiometricsForUser(userId: UserId): Promise<UserKey | null> {
    try {
      await this.ensureConnected();

      const response = await this.nativeMessagingBackground().callCommand({
        command: BiometricsCommands.UnlockWithBiometricsForUser,
        userId: userId,
      });
      if (response.response) {
        // In case the requesting foreground context dies (popup), the userkey should still be set, so the user is unlocked / the setting should be enabled
        const decodedUserkey = Utils.fromB64ToArray(response.userKeyB64);
        const userKey = new SymmetricCryptoKey(decodedUserkey) as UserKey;
        if (await this.keyService.validateUserKey(userKey, userId)) {
          await this.biometricStateService.setBiometricUnlockEnabled(true);
          await this.keyService.setUserKey(userKey, userId);
          // to update badge and other things
          this.messagingService.send("switchAccount", { userId });
          return userKey;
        }
      } else {
        return null;
      }
    } catch (e) {
      this.logService.info("Biometric unlock for user failed", e);
      throw new Error("Biometric unlock failed");
    }

    return null;
  }

  async getBiometricsStatusForUser(id: UserId): Promise<BiometricsStatus> {
    try {
      await this.ensureConnected();

      return (
        await this.nativeMessagingBackground().callCommand({
          command: BiometricsCommands.GetBiometricsStatusForUser,
          userId: id,
        })
      ).response;
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return BiometricsStatus.DesktopDisconnected;
    }
  }

  // the first time we call, this might use an outdated version of the protocol, so we drop the response
  private async ensureConnected() {
    if (!this.nativeMessagingBackground().connected) {
      await this.nativeMessagingBackground().callCommand({
        command: BiometricsCommands.GetBiometricsStatus,
      });
    }
  }

  async getShouldAutopromptNow(): Promise<boolean> {
    return false;
  }

  async setShouldAutopromptNow(value: boolean): Promise<void> {}
  async canEnableBiometricUnlock(): Promise<boolean> {
    const status = await this.getBiometricsStatus();
    const isBiometricsAlreadyEnabled = await this.vaultTimeoutSettingsService.isBiometricLockSet();
    const statusAllowsBiometric =
      status !== BiometricsStatus.DesktopDisconnected &&
      status !== BiometricsStatus.NotEnabledInConnectedDesktopApp &&
      status !== BiometricsStatus.HardwareUnavailable;

    return statusAllowsBiometric || isBiometricsAlreadyEnabled;
  }
}
