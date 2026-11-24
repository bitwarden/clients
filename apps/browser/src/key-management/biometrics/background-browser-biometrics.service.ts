import { toTsBiometricsStatus } from "@bitwarden/common/key-management/biometrics-status-mapper";
import { fromTsUserId } from "@bitwarden/common/key-management/utils";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import {
  BiometricsService,
  BiometricsCommands,
  BiometricsStatus,
  KeyService,
  BiometricStateService,
} from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import {
  BiometricsStatus as SdkBiometricsStatus,
  ipcRequestAuthenticateBiometrics,
  ipcRequestGetBiometricsStatus,
  ipcRequestUnlockBiometrics,
} from "@bitwarden/sdk-internal";
import { UnlockMethod } from "@bitwarden/unlock";

import { SafariApp } from "../../browser/safariApp";
import { BrowserApi } from "../../platform/browser/browser-api";

export class BackgroundBrowserBiometricsService extends BiometricsService {
  BIOMETRICS_NO_INTERACTION_TIMEOUT = 500;
  BIOMETRICS_INTERACTION_TIMEOUT = 60_000;

  constructor(
    private logService: LogService,
    private keyService: () => KeyService,
    private biometricStateService: BiometricStateService,
    private messagingService: MessagingService,
    private vaultTimeoutSettingsService: () => VaultTimeoutSettingsService,
    private ipcService: () => IpcService,
    private platformUtilsService: PlatformUtilsService,
  ) {
    super();
  }

  /**
   * Safari has no SDK IPC transport to the desktop app; its Swift handler answers biometrics
   * itself. Every other browser asks the desktop app over SDK IPC.
   */
  private get safari(): boolean {
    return this.platformUtilsService.isSafari();
  }

  async authenticateWithBiometrics(): Promise<boolean> {
    if (this.safari) {
      const reply = await SafariApp.sendBiometricsCommand(
        BiometricsCommands.AuthenticateWithBiometrics,
      );
      return reply?.response === true;
    }

    try {
      return await ipcRequestAuthenticateBiometrics(
        this.ipcService().client,
        AbortSignal.timeout(this.BIOMETRICS_INTERACTION_TIMEOUT),
      );
    } catch {
      return false;
    }
  }

  async getBiometricsStatus(): Promise<BiometricsStatus> {
    if (!(await BrowserApi.permissionsGranted(["nativeMessaging"]))) {
      return BiometricsStatus.NativeMessagingPermissionMissing;
    }

    if (!this.safari) {
      return BiometricsStatus.Available;
    }

    const reply = await SafariApp.sendBiometricsCommand(BiometricsCommands.GetBiometricsStatus);
    if (reply == null) {
      return BiometricsStatus.DesktopDisconnected;
    }
    return (reply.response as BiometricsStatus) || BiometricsStatus.Available;
  }

  async unlockWithBiometricsForUser(userId: UserId): Promise<UserKey | null> {
    const userKey = this.safari
      ? await this.unlockWithSafari(userId)
      : await this.unlockWithDesktop(userId);
    if (userKey == null) {
      return null;
    }

    try {
      await this.biometricStateService.setBiometricUnlockEnabled(true, userId);
      await this.unlockService!.unlockWithDecryptedUserKey(
        userId,
        userKey,
        UnlockMethod.Biometrics,
      );
      // to update badge and other things
      this.messagingService.send("switchAccount", { userId });
      return userKey;
    } catch (e) {
      this.logService.info("Biometric unlock for user failed during unlock", e);
      return null;
    }
  }

  /** Asks the desktop app for the user key over SDK IPC, and checks it is this user's key. */
  private async unlockWithDesktop(userId: UserId): Promise<UserKey | null> {
    try {
      const response = await ipcRequestUnlockBiometrics(
        this.ipcService().client,
        fromTsUserId(userId),
        AbortSignal.timeout(this.BIOMETRICS_INTERACTION_TIMEOUT),
      );
      if (!response.user_key) {
        return null;
      }

      const userKey = SymmetricCryptoKey.fromSdk(response.user_key) as UserKey;
      if (!(await this.keyService().validateUserKey(userKey, userId))) {
        this.logService.info("Biometric unlock for user failed: invalid user key");
        return null;
      }
      return userKey;
    } catch (e) {
      this.logService.info("Biometric unlock for user failed", e);
      return null;
    }
  }

  /** Reads the user key the Safari app extension keeps in the keychain behind biometrics. */
  private async unlockWithSafari(userId: UserId): Promise<UserKey | null> {
    const reply = await SafariApp.sendBiometricsCommand(
      BiometricsCommands.UnlockWithBiometricsForUser,
      userId,
    );
    if (reply?.response !== true || reply.userKeyB64 == null) {
      return null;
    }
    return new SymmetricCryptoKey(Utils.fromB64ToArray(reply.userKeyB64)) as UserKey;
  }

  async getBiometricsStatusForUser(id: UserId): Promise<BiometricsStatus> {
    if (this.safari) {
      const reply = await SafariApp.sendBiometricsCommand(
        BiometricsCommands.GetBiometricsStatusForUser,
        id,
      );
      return reply == null
        ? BiometricsStatus.DesktopDisconnected
        : (reply.response as BiometricsStatus);
    }

    try {
      const status = await ipcRequestGetBiometricsStatus(
        this.ipcService().client,
        fromTsUserId(id),
        AbortSignal.timeout(this.BIOMETRICS_NO_INTERACTION_TIMEOUT),
      );
      // The status comes from the desktop app, so "not enabled" means not enabled there.
      if (status === SdkBiometricsStatus.NotEnabled) {
        return BiometricsStatus.NotEnabledInConnectedDesktopApp;
      }

      return toTsBiometricsStatus(status);
    } catch {
      return BiometricsStatus.DesktopDisconnected;
    }
  }

  async getShouldAutopromptNow(): Promise<boolean> {
    return false;
  }

  async setShouldAutopromptNow(value: boolean): Promise<void> {}
  async canEnableBiometricUnlock(): Promise<boolean> {
    const status = await this.getBiometricsStatus();
    const isBiometricsAlreadyEnabled =
      await this.vaultTimeoutSettingsService().isBiometricLockSet();
    const statusAllowsBiometric =
      status !== BiometricsStatus.DesktopDisconnected &&
      status !== BiometricsStatus.NotEnabledInConnectedDesktopApp &&
      status !== BiometricsStatus.HardwareUnavailable;

    return statusAllowsBiometric || isBiometricsAlreadyEnabled;
  }
  async setBiometricProtectedUnlockKeyForUser(
    userId: UserId,
    value: SymmetricCryptoKey,
  ): Promise<void> {}
  async enrollPersistent(userId: UserId, key: SymmetricCryptoKey): Promise<void> {}
  async hasPersistentKey(userId: UserId): Promise<boolean> {
    return false;
  }
  async deleteBiometricUnlockKeyForUser(userId: UserId): Promise<void> {}
}
