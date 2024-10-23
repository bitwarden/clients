import { inject } from "@angular/core";
import { combineLatest, defer, map, Observable } from "rxjs";

import { LockComponentService, UnlockOptions } from "@bitwarden/auth/angular";
import {
  PinServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsService, BiometricsStatus } from "@bitwarden/key-management";

import { BiometricErrors, BiometricErrorTypes } from "../models/biometricErrors";
import { BrowserRouterService } from "../platform/popup/services/browser-router.service";

export class ExtensionLockComponentService implements LockComponentService {
  private readonly userDecryptionOptionsService = inject(UserDecryptionOptionsServiceAbstraction);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly biometricsService = inject(BiometricsService);
  private readonly pinService = inject(PinServiceAbstraction);
  private readonly vaultTimeoutSettingsService = inject(VaultTimeoutSettingsService);
  private readonly cryptoService = inject(CryptoService);
  private readonly routerService = inject(BrowserRouterService);

  getPreviousUrl(): string | null {
    return this.routerService.getPreviousUrl();
  }

  getBiometricsError(error: any): string | null {
    const biometricsError = BiometricErrors[error?.message as BiometricErrorTypes];

    if (!biometricsError) {
      return null;
    }

    return biometricsError.description;
  }

  async isWindowVisible(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  getBiometricsUnlockBtnText(): string {
    return "unlockWithBiometrics";
  }

  private async isBiometricLockSet(userId: UserId): Promise<boolean> {
    const biometricLockSet = await this.vaultTimeoutSettingsService.isBiometricLockSet(userId);
    const hasBiometricEncryptedUserKeyStored = await this.cryptoService.hasUserKeyStored(
      KeySuffixOptions.Biometric,
      userId,
    );
    const platformSupportsSecureStorage = this.platformUtilsService.supportsSecureStorage();

    return (
      biometricLockSet && (hasBiometricEncryptedUserKeyStored || !platformSupportsSecureStorage)
    );
  }

  getAvailableUnlockOptions$(userId: UserId): Observable<UnlockOptions> {
    return combineLatest([
      // Note: defer is preferable b/c it delays the execution of the function until the observable is subscribed to
      defer(async () => await this.biometricsService.getBiometricsStatusForUser(userId)),
      this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
      defer(() => this.pinService.isPinDecryptionAvailable(userId)),
    ]).pipe(
      map(([biometricsStatus, userDecryptionOptions, pinDecryptionAvailable]) => {
        const unlockOpts: UnlockOptions = {
          masterPassword: {
            enabled: userDecryptionOptions.hasMasterPassword,
          },
          pin: {
            enabled: pinDecryptionAvailable,
          },
          biometrics: {
            enabled: biometricsStatus === BiometricsStatus.Available,
            biometricsStatus: biometricsStatus,
          },
        };
        return unlockOpts;
      }),
    );
  }
}
