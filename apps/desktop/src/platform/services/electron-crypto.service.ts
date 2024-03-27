import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { BiometricStateService } from "@bitwarden/common/platform/biometrics/biometric-state.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CryptoService } from "@bitwarden/common/platform/services/crypto.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { CsprngString } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey, MasterKey } from "@bitwarden/common/types/key";

export class ElectronCryptoService extends CryptoService {
  constructor(
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
  ) {
    super(
      masterPasswordService,
      keyGenerationService,
      cryptoFunctionService,
      encryptService,
      platformUtilsService,
      logService,
      stateService,
      accountService,
      stateProvider,
    );
  }

  override async hasUserKeyStored(keySuffix: KeySuffixOptions, userId?: UserId): Promise<boolean> {
    if (keySuffix === KeySuffixOptions.Biometric) {
      // TODO: Remove after 2023.10 release (https://bitwarden.atlassian.net/browse/PM-3474)
      const oldKey = await this.stateService.hasCryptoMasterKeyBiometric({ userId: userId });
      return oldKey || (await this.stateService.hasUserKeyBiometric({ userId: userId }));
    }
    return super.hasUserKeyStored(keySuffix, userId);
  }

  override async clearStoredUserKey(keySuffix: KeySuffixOptions, userId?: UserId): Promise<void> {
    if (keySuffix === KeySuffixOptions.Biometric) {
      await this.stateService.setUserKeyBiometric(null, { userId: userId });
      await this.biometricStateService.removeEncryptedClientKeyHalf(userId);
      await this.clearDeprecatedKeys(KeySuffixOptions.Biometric, userId);
      return;
    }
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    await super.clearStoredUserKey(keySuffix, userId);
  }

  protected override async storeAdditionalKeys(key: UserKey, userId?: UserId) {
    await super.storeAdditionalKeys(key, userId);

    const storeBiometricKey = await this.shouldStoreKey(KeySuffixOptions.Biometric, userId);

    if (storeBiometricKey) {
      await this.storeBiometricKey(key, userId);
    } else {
      await this.stateService.setUserKeyBiometric(null, { userId: userId });
    }
    await this.clearDeprecatedKeys(KeySuffixOptions.Biometric, userId);
  }

  protected override async getKeyFromStorage(
    keySuffix: KeySuffixOptions,
    userId?: UserId,
  ): Promise<UserKey> {
    if (keySuffix === KeySuffixOptions.Biometric) {
      await this.migrateBiometricKeyIfNeeded(userId);
      const userKey = await this.stateService.getUserKeyBiometric({ userId: userId });
      return new SymmetricCryptoKey(Utils.fromB64ToArray(userKey)) as UserKey;
    }
    return await super.getKeyFromStorage(keySuffix, userId);
  }

  protected async storeBiometricKey(key: UserKey, userId?: UserId): Promise<void> {
    // May resolve to null, in which case no client key have is required
    const clientEncKeyHalf = await this.getBiometricEncryptionClientKeyHalf(key, userId);
    await this.stateService.setUserKeyBiometric(
      { key: key.keyB64, clientEncKeyHalf },
      { userId: userId },
    );
  }

  protected async shouldStoreKey(keySuffix: KeySuffixOptions, userId?: UserId): Promise<boolean> {
    if (keySuffix === KeySuffixOptions.Biometric) {
      const biometricUnlockPromise =
        userId == null
          ? firstValueFrom(this.biometricStateService.biometricUnlockEnabled$)
          : this.biometricStateService.getBiometricUnlockEnabled(userId);
      const biometricUnlock = await biometricUnlockPromise;
      return biometricUnlock && this.platformUtilService.supportsSecureStorage();
    }
    return await super.shouldStoreKey(keySuffix, userId);
  }

  protected override async clearAllStoredUserKeys(userId?: UserId): Promise<void> {
    await this.clearStoredUserKey(KeySuffixOptions.Biometric, userId);
    await super.clearAllStoredUserKeys(userId);
  }

  private async getBiometricEncryptionClientKeyHalf(
    userKey: UserKey,
    userId: UserId,
  ): Promise<CsprngString | null> {
    const requireClientKeyHalf = await this.biometricStateService.getRequirePasswordOnStart(userId);
    if (!requireClientKeyHalf) {
      return null;
    }

    // Retrieve existing key half if it exists
    let biometricKey = await this.biometricStateService
      .getEncryptedClientKeyHalf(userId)
      .then((result) => result?.decrypt(null /* user encrypted */, userKey))
      .then((result) => result as CsprngString);
    if (biometricKey == null && userKey != null) {
      // Set a key half if it doesn't exist
      const keyBytes = await this.cryptoFunctionService.randomBytes(32);
      biometricKey = Utils.fromBufferToUtf8(keyBytes) as CsprngString;
      const encKey = await this.encryptService.encrypt(biometricKey, userKey);
      await this.biometricStateService.setEncryptedClientKeyHalf(encKey, userId);
    }

    return biometricKey;
  }

  // --LEGACY METHODS--
  // We previously used the master key for additional keys, but now we use the user key.
  // These methods support migrating the old keys to the new ones.
  // TODO: Remove after 2023.10 release (https://bitwarden.atlassian.net/browse/PM-3475)

  override async clearDeprecatedKeys(keySuffix: KeySuffixOptions, userId?: UserId) {
    if (keySuffix === KeySuffixOptions.Biometric) {
      await this.stateService.setCryptoMasterKeyBiometric(null, { userId: userId });
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    super.clearDeprecatedKeys(keySuffix, userId);
  }

  private async migrateBiometricKeyIfNeeded(userId?: UserId) {
    if (await this.stateService.hasCryptoMasterKeyBiometric({ userId })) {
      const oldBiometricKey = await this.stateService.getCryptoMasterKeyBiometric({ userId });
      // decrypt
      const masterKey = new SymmetricCryptoKey(Utils.fromB64ToArray(oldBiometricKey)) as MasterKey;
      userId ??= (await firstValueFrom(this.accountService.activeAccount$))?.id;
      const encUserKeyPrim = await this.stateService.getEncryptedCryptoSymmetricKey();
      const encUserKey =
        encUserKeyPrim != null
          ? new EncString(encUserKeyPrim)
          : await this.masterPasswordService.getMasterKeyEncryptedUserKey(userId);
      if (!encUserKey) {
        throw new Error("No user key found during biometric migration");
      }
      const userKey = await this.decryptUserKeyWithMasterKey(masterKey, encUserKey);
      // migrate
      await this.storeBiometricKey(userKey, userId);
      await this.stateService.setCryptoMasterKeyBiometric(null, { userId });
    }
  }
}
