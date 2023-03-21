import { CryptoFunctionService } from "@bitwarden/common/abstractions/cryptoFunction.service";
import { EncryptService } from "@bitwarden/common/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { KeySuffixOptions } from "@bitwarden/common/enums/keySuffixOptions";
import { SymmetricCryptoKey } from "@bitwarden/common/models/domain/symmetric-crypto-key";
import { CryptoService } from "@bitwarden/common/services/crypto.service";
import { Guid } from "@bitwarden/common/types/guid";

export class ElectronCryptoService extends CryptoService {
  constructor(
    cryptoFunctionService: CryptoFunctionService,
    encryptService: EncryptService,
    platformUtilService: PlatformUtilsService,
    logService: LogService,
    stateService: StateService
  ) {
    super(cryptoFunctionService, encryptService, platformUtilService, logService, stateService);
  }

  async hasKeyStored(keySuffix: KeySuffixOptions): Promise<boolean> {
    await this.upgradeSecurelyStoredKey();
    return super.hasKeyStored(keySuffix);
  }

  protected async storeKey(key: SymmetricCryptoKey, userId?: Guid) {
    if (await this.shouldStoreKey(KeySuffixOptions.Auto, userId)) {
      await this.stateService.setCryptoMasterKeyAuto(key.keyB64, { userId: userId });
    } else {
      this.clearStoredKey(KeySuffixOptions.Auto);
    }

    if (await this.shouldStoreKey(KeySuffixOptions.Biometric, userId)) {
      await this.stateService.setCryptoMasterKeyBiometric(key.keyB64, { userId: userId });
    } else {
      this.clearStoredKey(KeySuffixOptions.Biometric);
    }
  }

  protected async retrieveKeyFromStorage(keySuffix: KeySuffixOptions, userId?: Guid) {
    await this.upgradeSecurelyStoredKey();
    return super.retrieveKeyFromStorage(keySuffix, userId);
  }

  /**
   * @deprecated 4 Jun 2021 This is temporary upgrade method to move from a single shared stored key to
   * multiple, unique stored keys for each use, e.g. never logout vs. biometric authentication.
   */
  private async upgradeSecurelyStoredKey() {
    // attempt key upgrade, but if we fail just delete it. Keys will be stored property upon unlock anyway.
    const key = await this.stateService.getCryptoMasterKeyB64();

    if (key == null) {
      return;
    }

    try {
      if (await this.shouldStoreKey(KeySuffixOptions.Auto)) {
        await this.stateService.setCryptoMasterKeyAuto(key);
      }
      if (await this.shouldStoreKey(KeySuffixOptions.Biometric)) {
        await this.stateService.setCryptoMasterKeyBiometric(key);
      }
    } catch (e) {
      this.logService.error(
        `Encountered error while upgrading obsolete Bitwarden secure storage item:`
      );
      this.logService.error(e);
    }

    await this.stateService.setCryptoMasterKeyB64(null);
  }
}
