import { BehaviorSubject, combineLatest, EMPTY, timer } from "rxjs";
import { filter, concatMap, switchMap } from "rxjs/operators";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { toTsBiometricsStatus } from "@bitwarden/common/key-management/biometrics-status-mapper";
import { fromTsUserId } from "@bitwarden/common/key-management/utils";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
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
import {
  ipcRequestAuthenticateBiometrics,
  ipcRequestGetBiometricsStatus,
  ipcRequestUnlockBiometrics,
} from "@bitwarden/sdk-internal";

import { NativeMessagingBackground } from "../../background/nativeMessaging.background";

export class BackgroundBrowserBiometricsService extends BiometricsService {
  BACKGROUND_POLLING_INTERVAL = 30_000;

  private activePollingUser$ = new BehaviorSubject<UserId | null>(null);

  constructor(
    private nativeMessagingBackground: () => NativeMessagingBackground,
    private configService: () => ConfigService,
    private logService: LogService,
    private keyService: KeyService,
    private biometricStateService: BiometricStateService,
    private messagingService: MessagingService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private ipcService: () => IpcService,
  ) {
    super();
    // Always connect to the native messaging background if biometrics are enabled, not just when it is used
    // so that there is no wait when used.
    this.activePollingUser$
      .pipe(
        switchMap((userId) => {
          if (userId == null) {
            return EMPTY;
          }
          return combineLatest([
            timer(0, this.BACKGROUND_POLLING_INTERVAL),
            this.biometricStateService.biometricUnlockEnabled$(userId),
          ]).pipe(
            filter(([_, enabled]) => enabled),
            filter(() => !this.nativeMessagingBackground().connected),
            concatMap(async () => {
              try {
                await this.nativeMessagingBackground().connect();
                await this.getBiometricsStatus();
              } catch {
                // Ignore
              }
            }),
          );
        }),
      )
      .subscribe();
  }

  startPolling(userId: UserId): void {
    this.activePollingUser$.next(userId);
  }

  stopPolling(): void {
    this.activePollingUser$.next(null);
  }

  async authenticateWithBiometrics(): Promise<boolean> {
    if (await this.configService().getFeatureFlag(FeatureFlag.BiometricsSDKIPC)) {
      if (!this.nativeMessagingBackground().connected) {
        return false;
      } else {
        return await ipcRequestAuthenticateBiometrics(this.ipcService().client);
      }
    }

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
    if (await this.configService().getFeatureFlag(FeatureFlag.BiometricsSDKIPC)) {
      if (!this.nativeMessagingBackground().connected) {
        return BiometricsStatus.DesktopDisconnected;
      } else {
        // Handle SDK-based biometrics status check
        return BiometricsStatus.Available;
      }
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
    if (await this.configService().getFeatureFlag(FeatureFlag.BiometricsSDKIPC)) {
      if (!this.nativeMessagingBackground().connected) {
        return null;
      } else {
        // Handle SDK-based biometric unlock
        try {
          const response = await ipcRequestUnlockBiometrics(
            this.ipcService().client,
            fromTsUserId(userId),
          );
          if (response.user_key) {
            const userKey = SymmetricCryptoKey.fromSdk(response.user_key) as UserKey;
            if (!(await this.keyService.validateUserKey(userKey, userId))) {
              this.logService.info("Biometric unlock for user failed: invalid user key");
              return null;
            }

            await this.biometricStateService.setBiometricUnlockEnabled(true, userId);
            await this.keyService.setUserKey(userKey, userId);
            // to update badge and other things
            this.messagingService.send("switchAccount", { userId });
            return userKey;
          } else {
            return null;
          }
        } catch (e) {
          this.logService.info("Biometric unlock for user failed", e);
          return null;
        }
      }
    }

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
        try {
          await this.unlockService!.unlockWithDecryptedUserKey(userId, userKey);
          await this.biometricStateService.setBiometricUnlockEnabled(true, userId);
          // to update badge and other things
          this.messagingService.send("switchAccount", { userId });
          return userKey;
        } catch (e) {
          this.logService.info("Biometric unlock for user failed during unlock or validation", e);
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
    if (await this.configService().getFeatureFlag(FeatureFlag.BiometricsSDKIPC)) {
      if (!this.nativeMessagingBackground().connected) {
        return BiometricsStatus.DesktopDisconnected;
      } else {
        const status = await ipcRequestGetBiometricsStatus(
          this.ipcService().client,
          fromTsUserId(id),
        );
        return toTsBiometricsStatus(status);
      }
    }

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
  async setBiometricProtectedUnlockKeyForUser(
    userId: UserId,
    value: SymmetricCryptoKey,
  ): Promise<void> {}
  async enrollPersistent(userId: UserId, key: SymmetricCryptoKey): Promise<void> {}
  async hasPersistentKey(userId: UserId): Promise<boolean> {
    return false;
  }
}
