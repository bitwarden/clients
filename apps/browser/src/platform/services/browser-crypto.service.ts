import { KeySuffixOptions } from "@bitwarden/common/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  SymmetricCryptoKey,
  UserKey,
} from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CryptoService } from "@bitwarden/common/platform/services/crypto.service";

export class BrowserCryptoService extends CryptoService {
  override async hasUserKeyStored(keySuffix: KeySuffixOptions, userId?: string): Promise<boolean> {
    if (keySuffix === KeySuffixOptions.Biometric) {
      return await this.stateService.getBiometricUnlock({ userId: userId });
    }
    return super.hasUserKeyStored(keySuffix, userId);
  }

  /**
   * Browser doesn't store biometric keys, so we retrieve them from the desktop and return
   * if we successfully saved it into memory as the User Key
   */
  protected override async getKeyFromStorage(keySuffix: KeySuffixOptions): Promise<UserKey> {
    if (keySuffix === KeySuffixOptions.Biometric) {
      await this.platformUtilService.authenticateBiometric();
      const userKey = await this.stateService.getUserKey();
      if (userKey) {
        return new SymmetricCryptoKey(Utils.fromB64ToArray(userKey.keyB64)) as UserKey;
      }
    }

    return await super.getKeyFromStorage(keySuffix);
  }
}
