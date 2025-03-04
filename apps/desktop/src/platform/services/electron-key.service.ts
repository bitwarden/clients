import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";
import { CsprngString } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import {
  KdfConfigService,
  DefaultKeyService,
  BiometricStateService,
} from "@bitwarden/key-management";

import { DesktopBiometricsService } from "../../key-management/biometrics/desktop.biometrics.service";

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

  override async hasUserKeyStored(keySuffix: KeySuffixOptions, userId?: UserId): Promise<boolean> {
    return super.hasUserKeyStored(keySuffix, userId);
  }

  override async clearStoredUserKey(keySuffix: KeySuffixOptions, userId?: UserId): Promise<void> {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
    // May resolve to null, in which case no client key have is required
    // TODO: Move to windows implementation
    const clientEncKeyHalf = await this.getBiometricEncryptionClientKeyHalf(userKey, userId);
    await this.biometricService.setClientKeyHalfForUser(userId, clientEncKeyHalf);
    await this.biometricService.setBiometricProtectedUnlockKeyForUser(userId, userKey.keyB64);
  }

  protected async shouldStoreKey(keySuffix: KeySuffixOptions, userId: UserId): Promise<boolean> {
    return await super.shouldStoreKey(keySuffix, userId);
  }

  protected override async clearAllStoredUserKeys(userId: UserId): Promise<void> {
    await this.biometricService.deleteBiometricUnlockKeyForUser(userId);
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
    let clientKeyHalf = await this.biometricStateService
      .getEncryptedClientKeyHalf(userId)
      .then((result) => result?.decrypt(null /* user encrypted */, userKey))
      .then((result) => result as CsprngString);
    if (clientKeyHalf == null && userKey != null) {
      // Set a key half if it doesn't exist
      const keyBytes = await this.cryptoFunctionService.randomBytes(32);
      clientKeyHalf = Utils.fromBufferToUtf8(keyBytes) as CsprngString;
      const encKey = await this.encryptService.encrypt(clientKeyHalf, userKey);
      await this.biometricStateService.setEncryptedClientKeyHalf(encKey, userId);
    }

    return clientKeyHalf;
  }
}
