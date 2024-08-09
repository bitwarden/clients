import { firstValueFrom } from "rxjs";

import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { KdfConfigService } from "@bitwarden/common/auth/abstractions/kdf-config.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { BiometricStateService } from "@bitwarden/common/platform/biometrics/biometric-state.service";
import { BiometricsService } from "@bitwarden/common/platform/biometrics/biometric.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { CryptoService } from "@bitwarden/common/platform/services/crypto.service";
import { USER_KEY } from "@bitwarden/common/platform/services/key-state/user-key.state";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";

export class BrowserCryptoService extends CryptoService {
  constructor(
    pinService: PinServiceAbstraction,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    keyGenerationService: KeyGenerationService,
    cryptoFunctionService: CryptoFunctionService,
    encryptService: EncryptService,
    platformUtilService: PlatformUtilsService,
    logService: LogService,
    stateService: StateService,
    accountService: AccountService,
    stateProvider: StateProvider,
    private biometricStateService: BiometricStateService,
    private biometricsService: BiometricsService,
    kdfConfigService: KdfConfigService,
  ) {
    super(
      pinService,
      masterPasswordService,
      keyGenerationService,
      cryptoFunctionService,
      encryptService,
      platformUtilService,
      logService,
      stateService,
      accountService,
      stateProvider,
      kdfConfigService,
    );
  }
  override async hasUserKeyStored(keySuffix: KeySuffixOptions, userId?: UserId): Promise<boolean> {
    if (keySuffix === KeySuffixOptions.Biometric) {
      const biometricUnlockPromise =
        userId == null
          ? firstValueFrom(this.biometricStateService.biometricUnlockEnabled$)
          : this.biometricStateService.getBiometricUnlockEnabled(userId);
      return await biometricUnlockPromise;
    }
    return super.hasUserKeyStored(keySuffix, userId);
  }

  /**
   * Browser doesn't store biometric keys, so we retrieve them from the desktop and return
   * if we successfully saved it into memory as the User Key
   * @returns the `UserKey` if the user passes a biometrics prompt, otherwise return `null`.
   */
  protected override async getKeyFromStorage(
    keySuffix: KeySuffixOptions,
    userId?: UserId,
  ): Promise<UserKey> {
    if (keySuffix === KeySuffixOptions.Biometric) {
      const biometricsResult = await this.biometricsService.authenticateBiometric();

      if (!biometricsResult) {
        return null;
      }

      const userKey = await firstValueFrom(this.stateProvider.getUserState$(USER_KEY, userId));
      if (userKey) {
        return userKey;
      }
    }

    return await super.getKeyFromStorage(keySuffix, userId);
  }
}
