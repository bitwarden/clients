import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import {
  KdfConfigService,
  DefaultKeyService,
  BiometricStateService,
} from "@bitwarden/key-management";

import { DesktopBiometricsService } from "./biometrics/desktop.biometrics.service";

// TODO Remove this class once biometric client key half storage is moved https://bitwarden.atlassian.net/browse/PM-22342
export class ElectronKeyService extends DefaultKeyService {
  constructor(
    pinService: PinServiceAbstraction,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    keyGenerationService: KeyGenerationService,
    cryptoFunctionService: CryptoFunctionService,
    encryptService: EncryptService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    stateService: StateService,
    accountService: AccountService,
    stateProvider: StateProvider,
    private biometricStateService: BiometricStateService,
    kdfConfigService: KdfConfigService,
    private biometricService: DesktopBiometricsService,
  ) {
    super(
      pinService,
      masterPasswordService,
      keyGenerationService,
      cryptoFunctionService,
      encryptService,
      platformUtilsService,
      logService,
      stateService,
      accountService,
      stateProvider,
      kdfConfigService,
    );
  }

  override async clearStoredUserKey(keySuffix: KeySuffixOptions, userId: UserId): Promise<void> {
    await super.clearStoredUserKey(keySuffix, userId);
  }

  protected override async storeAdditionalKeys(key: UserKey, userId: UserId) {
    await super.storeAdditionalKeys(key, userId);

    if (await this.biometricStateService.getBiometricUnlockEnabled(userId)) {
      await this.storeBiometricsProtectedUserKey(key, userId);
    }
  }

  protected override async getKeyFromStorage(
    keySuffix: KeySuffixOptions,
    userId?: UserId,
  ): Promise<UserKey | null> {
    return await super.getKeyFromStorage(keySuffix, userId);
  }

  private async storeBiometricsProtectedUserKey(userKey: UserKey, userId: UserId): Promise<void> {
    await this.biometricService.setBiometricProtectedUnlockKeyForUser(userId, userKey);
  }

  protected async shouldStoreKey(keySuffix: KeySuffixOptions, userId: UserId): Promise<boolean> {
    return await super.shouldStoreKey(keySuffix, userId);
  }

  protected override async clearAllStoredUserKeys(userId: UserId): Promise<void> {
    await this.biometricService.deleteBiometricUnlockKeyForUser(userId);
    await super.clearAllStoredUserKeys(userId);
  }
}
