import { inject } from "@angular/core";
import { combineLatest, defer, map, Observable } from "rxjs";

import {
  BiometricsDisableReason,
  LockComponentService,
  UnlockOptions,
} from "@bitwarden/auth/angular";
import {
  PinServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { DeviceType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService, BiometricsService } from "@bitwarden/key-management";

export class DesktopLockComponentService implements LockComponentService {
  private readonly userDecryptionOptionsService = inject(UserDecryptionOptionsServiceAbstraction);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly biometricsService = inject(BiometricsService);
  private readonly pinService = inject(PinServiceAbstraction);
  private readonly vaultTimeoutSettingsService = inject(VaultTimeoutSettingsService);
  private readonly keyService = inject(KeyService);

  constructor() {}

  getBiometricsError(error: any): string | null {
    return null;
  }

  getPreviousUrl(): string | null {
    return null;
  }

  async isWindowVisible(): Promise<boolean> {
    return ipc.platform.isWindowVisible();
  }

  getBiometricsUnlockBtnText(): string {
    switch (this.platformUtilsService.getDevice()) {
      case DeviceType.MacOsDesktop:
        return "unlockWithTouchId";
      case DeviceType.WindowsDesktop:
        return "unlockWithWindowsHello";
      case DeviceType.LinuxDesktop:
        return "unlockWithPolkit";
      default:
        throw new Error("Unsupported platform");
    }
  }

  private async isBiometricLockSet(userId: UserId): Promise<boolean> {
    const biometricLockSet = await this.vaultTimeoutSettingsService.isBiometricLockSet(userId);
    const hasBiometricEncryptedUserKeyStored = await this.keyService.hasUserKeyStored(
      KeySuffixOptions.Biometric,
      userId,
    );
    const platformSupportsSecureStorage = this.platformUtilsService.supportsSecureStorage();

    return (
      biometricLockSet && (hasBiometricEncryptedUserKeyStored || !platformSupportsSecureStorage)
    );
  }

  private async isBiometricsSupportedAndReady(
    userId: UserId,
  ): Promise<{ supportsBiometric: boolean; biometricReady: boolean }> {
    const supportsBiometric = await this.biometricsService.supportsBiometric();
    const biometricReady = await ipc.keyManagement.biometric.enabled(userId);
    return { supportsBiometric, biometricReady };
  }

  getAvailableUnlockOptions$(userId: UserId): Observable<UnlockOptions> {
    return combineLatest([
      // Note: defer is preferable b/c it delays the execution of the function until the observable is subscribed to
      defer(() => this.isBiometricsSupportedAndReady(userId)),
      defer(() => this.isBiometricLockSet(userId)),
      this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
      defer(() => this.pinService.isPinDecryptionAvailable(userId)),
    ]).pipe(
      map(
        ([biometricsData, isBiometricsLockSet, userDecryptionOptions, pinDecryptionAvailable]) => {
          const disableReason = this.getBiometricsDisabledReason(
            biometricsData.supportsBiometric,
            isBiometricsLockSet,
            biometricsData.biometricReady,
          );

          const unlockOpts: UnlockOptions = {
            masterPassword: {
              enabled: userDecryptionOptions.hasMasterPassword,
            },
            pin: {
              enabled: pinDecryptionAvailable,
            },
            biometrics: {
              enabled:
                biometricsData.supportsBiometric &&
                isBiometricsLockSet &&
                biometricsData.biometricReady,
              disableReason: disableReason,
            },
          };

          return unlockOpts;
        },
      ),
    );
  }

  private getBiometricsDisabledReason(
    osSupportsBiometric: boolean,
    biometricLockSet: boolean,
    biometricReady: boolean,
  ): BiometricsDisableReason | null {
    if (!osSupportsBiometric) {
      return BiometricsDisableReason.NotSupportedOnOperatingSystem;
    } else if (!biometricLockSet) {
      return BiometricsDisableReason.EncryptedKeysUnavailable;
    } else if (!biometricReady) {
      return BiometricsDisableReason.SystemBiometricsUnavailable;
    }
    return null;
  }
}
