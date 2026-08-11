import * as bigInt from "big-integer";
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EFFLongWordList } from "@bitwarden/common/platform/misc/wordlist";
import { UserId } from "@bitwarden/common/types/guid";
import { OrgKey, UserKey, MasterKey, ProviderKey } from "@bitwarden/common/types/key";
// Type-only: @bitwarden/key-management re-exports this package, so a value import would be circular.
import type { KdfConfigService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { CryptoFunctionService } from "../abstractions/crypto-function.service";
import { EncryptService } from "../abstractions/encrypt.service";
import { KeyGenerationService } from "../abstractions/key-generation.service";
import { LegacyCompatKeyService as LegacyCompatKeyServiceAbstraction } from "../abstractions/legacy-compat-key.service";
import { EncryptionType } from "../enums/encryption-type.enum";
import { EncString } from "../models/enc-string";
import { KdfConfig } from "../models/kdf-config";
import { SymmetricCryptoKey } from "../models/symmetric-crypto-key";
import { CsprngArray } from "../types/csprng";

export class DefaultLegacyCompatKeyService implements LegacyCompatKeyServiceAbstraction {
  constructor(
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private keyGenerationService: KeyGenerationService,
    private cryptoFunctionService: CryptoFunctionService,
    private encryptService: EncryptService,
    private logService: LogService,
    private accountService: AccountService,
    private kdfConfigService: KdfConfigService,
    private keyService: KeyService,
  ) {}

  async makeUserKey(masterKey: MasterKey): Promise<[UserKey, EncString]> {
    if (!masterKey) {
      throw new Error("MasterKey is required");
    }

    await SdkLoadService.Ready;
    const newUserKey = SymmetricCryptoKey.fromSdk(PureCrypto.make_aes256_cbc_hmac_key());
    return this.buildProtectedSymmetricKey(masterKey, newUserKey);
  }

  /**
   * @deprecated Please use `makeMasterPasswordAuthenticationData`, `unwrapUserKeyFromMasterPasswordUnlockData` or `makeMasterPasswordUnlockData` in @link MasterPasswordService instead.
   */
  async getOrDeriveMasterKey(password: string, userId: UserId): Promise<MasterKey> {
    if (userId == null) {
      throw new Error("User ID is required.");
    }

    const masterKey = await firstValueFrom(this.masterPasswordService.masterKey$(userId));
    if (masterKey != null) {
      return masterKey;
    }

    const email = await firstValueFrom(
      this.accountService.accounts$.pipe(map((accounts) => accounts[userId]?.email)),
    );
    if (email == null) {
      throw new Error("No email found for user " + userId);
    }

    const kdf = await firstValueFrom(this.kdfConfigService.getKdfConfig$(userId));
    if (kdf == null) {
      throw new Error("No kdf found for user " + userId);
    }

    return await this.makeMasterKey(password, email, kdf);
  }

  /**
   * Derive a master key from a password and email.
   *
   * @deprecated Please use `makeMasterPasswordAuthenticationData`, `makeMasterPasswordAuthenticationData`, `unwrapUserKeyFromMasterPasswordUnlockData` in @link MasterPasswordService instead.
   *
   * @remarks
   * Does not validate the kdf config to ensure it satisfies the minimum requirements for the given kdf type.
   */
  async makeMasterKey(password: string, email: string, kdfConfig: KdfConfig): Promise<MasterKey> {
    const start = new Date().getTime();
    email = email.trim().toLowerCase();
    const masterKey = (await this.keyGenerationService.deriveKeyFromPassword(
      password,
      email,
      kdfConfig,
    )) as MasterKey;
    const end = new Date().getTime();
    this.logService.info(`[LegacyCompatKeyService] Deriving master key took ${end - start}ms`);

    return masterKey;
  }

  /**
   * @deprecated Please use `makeMasterPasswordUnlockData` in {@link MasterPasswordService} instead.
   */
  async encryptUserKeyWithMasterKey(
    masterKey: MasterKey,
    userKey: UserKey,
  ): Promise<[UserKey, EncString]> {
    if (masterKey == null) {
      throw new Error("masterKey is required.");
    }
    if (userKey == null) {
      throw new Error("userKey is required.");
    }

    return await this.buildProtectedSymmetricKey(masterKey, userKey);
  }

  /**
   * @deprecated Please use `makeMasterPasswordAuthenticationData` in {@link MasterPasswordService} instead.
   */
  async hashMasterKey(password: string, key: MasterKey): Promise<string> {
    if (password == null) {
      throw new Error("password is required.");
    }
    if (key == null) {
      throw new Error("key is required.");
    }

    // Server authorization always uses one iteration
    const iterations = 1;
    const hash = await this.cryptoFunctionService.pbkdf2(
      key.inner().encryptionKey,
      password,
      "sha256",
      iterations,
    );
    return Utils.fromBufferToB64(hash);
  }

  async makeDataEncKey<T extends OrgKey | UserKey>(
    key: T,
  ): Promise<[SymmetricCryptoKey, EncString]> {
    if (key == null) {
      throw new Error("No key provided");
    }

    // Content encryption key is AES256_CBC_HMAC
    await SdkLoadService.Ready;
    const cek = SymmetricCryptoKey.fromSdk(PureCrypto.make_aes256_cbc_hmac_key());
    const wrappedCek = await this.encryptService.wrapSymmetricKey(cek, key);
    return [cek, wrappedCek];
  }

  async makeOrgKey<T extends OrgKey | ProviderKey>(userId: UserId): Promise<[EncString, T]> {
    if (userId == null) {
      throw new Error("UserId is required");
    }

    const publicKey = await firstValueFrom(this.keyService.userPublicKey$(userId));
    if (publicKey == null) {
      throw new Error("No public key found for user " + userId);
    }

    await SdkLoadService.Ready;
    const shareKey = SymmetricCryptoKey.fromSdk(PureCrypto.make_aes256_cbc_hmac_key());
    const encShareKey = await this.encryptService.encapsulateKeyUnsigned(shareKey, publicKey);
    return [encShareKey, shareKey as T];
  }

  async getFingerprint(fingerprintMaterial: string, publicKey: Uint8Array): Promise<string[]> {
    if (publicKey == null) {
      throw new Error("Public key is required to generate a fingerprint.");
    }

    const keyFingerprint = await this.cryptoFunctionService.hash(publicKey, "sha256");
    const userFingerprint = await this.cryptoFunctionService.hkdfExpand(
      keyFingerprint,
      fingerprintMaterial,
      32,
      "sha256",
    );
    return this.hashPhrase(userFingerprint);
  }

  async makeKeyPair(key: SymmetricCryptoKey): Promise<[string, EncString]> {
    if (key == null) {
      throw new Error("'key' is a required parameter and must be non-null.");
    }

    const keyPair = await this.cryptoFunctionService.rsaGenerateKeyPair(2048);
    const publicB64 = Utils.fromBufferToB64(keyPair[0]);
    const privateEnc = await this.encryptService.wrapDecapsulationKey(keyPair[1], key);
    return [publicB64, privateEnc];
  }

  async makeSendKey(keyMaterial: CsprngArray): Promise<SymmetricCryptoKey> {
    return await this.keyGenerationService.deriveKeyFromMaterial(
      keyMaterial,
      "bitwarden-send",
      "send",
    );
  }

  private async hashPhrase(hash: Uint8Array, minimumEntropy = 64) {
    const entropyPerWord = Math.log(EFFLongWordList.length) / Math.log(2);
    let numWords = Math.ceil(minimumEntropy / entropyPerWord);

    const hashArr = Array.from(new Uint8Array(hash));
    const entropyAvailable = hashArr.length * 4;
    if (numWords * entropyPerWord > entropyAvailable) {
      throw new Error("Output entropy of hash function is too small");
    }

    const phrase: string[] = [];
    let hashNumber = bigInt.fromArray(hashArr, 256);
    while (numWords--) {
      const remainder = hashNumber.mod(EFFLongWordList.length);
      hashNumber = hashNumber.divide(EFFLongWordList.length);
      phrase.push(EFFLongWordList[remainder as any]);
    }
    return phrase;
  }

  /**
   * @deprecated
   * This should only be used for wrapping the user key with a master key or stretched master key.
   */
  private async buildProtectedSymmetricKey<T extends SymmetricCryptoKey>(
    encryptionKey: SymmetricCryptoKey,
    newSymKey: SymmetricCryptoKey,
  ): Promise<[T, EncString]> {
    let protectedSymKey: EncString;
    if (encryptionKey.inner().type === EncryptionType.AesCbc256_B64) {
      const stretchedEncryptionKey = await this.keyGenerationService.stretchKey(encryptionKey);
      protectedSymKey = await this.encryptService.wrapSymmetricKey(
        newSymKey,
        stretchedEncryptionKey,
      );
    } else if (encryptionKey.inner().type === EncryptionType.AesCbc256_HmacSha256_B64) {
      protectedSymKey = await this.encryptService.wrapSymmetricKey(newSymKey, encryptionKey);
    } else {
      throw new Error("Invalid key size.");
    }
    return [newSymKey as T, protectedSymKey];
  }
}
