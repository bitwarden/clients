import * as bigInt from "big-integer";

import { EncryptedOrganizationKeyData } from "../../admin-console/models/data/encrypted-organization-key.data";
import { BaseEncryptedOrganizationKey } from "../../admin-console/models/domain/encrypted-organization-key";
import { ProfileOrganizationResponse } from "../../admin-console/models/response/profile-organization.response";
import { ProfileProviderOrganizationResponse } from "../../admin-console/models/response/profile-provider-organization.response";
import { ProfileProviderResponse } from "../../admin-console/models/response/profile-provider.response";
import { KdfConfig } from "../../auth/models/domain/kdf-config";
import {
  KeySuffixOptions,
  HashPurpose,
  KdfType,
  DEFAULT_ARGON2_ITERATIONS,
  DEFAULT_ARGON2_MEMORY,
  DEFAULT_ARGON2_PARALLELISM,
  EncryptionType,
} from "../../enums";
import { Utils } from "../../platform/misc/utils";
import { CryptoFunctionService } from "../abstractions/crypto-function.service";
import { CryptoService as CryptoServiceAbstraction } from "../abstractions/crypto.service";
import { EncryptService } from "../abstractions/encrypt.service";
import { LogService } from "../abstractions/log.service";
import { PlatformUtilsService } from "../abstractions/platform-utils.service";
import { StateService } from "../abstractions/state.service";
import { sequentialize } from "../misc/sequentialize";
import { EFFLongWordList } from "../misc/wordlist";
import { EncArrayBuffer } from "../models/domain/enc-array-buffer";
import { EncString } from "../models/domain/enc-string";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";

export class CryptoService implements CryptoServiceAbstraction {
  constructor(
    protected cryptoFunctionService: CryptoFunctionService,
    protected encryptService: EncryptService,
    protected platformUtilService: PlatformUtilsService,
    protected logService: LogService,
    protected stateService: StateService
  ) {}

  async setKey(key: SymmetricCryptoKey, userId?: string): Promise<any> {
    await this.stateService.setCryptoMasterKey(key, { userId: userId });
    await this.storeKey(key, userId);
  }

  async setKeyHash(keyHash: string): Promise<void> {
    await this.stateService.setKeyHash(keyHash);
  }

  async setEncKey(encKey: string): Promise<void> {
    if (encKey == null) {
      return;
    }

    await this.stateService.setDecryptedCryptoSymmetricKey(null);
    await this.stateService.setEncryptedCryptoSymmetricKey(encKey);
  }

  async setEncPrivateKey(encPrivateKey: string): Promise<void> {
    if (encPrivateKey == null) {
      return;
    }

    await this.stateService.setDecryptedPrivateKey(null);
    await this.stateService.setEncryptedPrivateKey(encPrivateKey);
  }

  async setOrgKeys(
    orgs: ProfileOrganizationResponse[] = [],
    providerOrgs: ProfileProviderOrganizationResponse[] = []
  ): Promise<void> {
    const encOrgKeyData: { [orgId: string]: EncryptedOrganizationKeyData } = {};

    orgs.forEach((org) => {
      encOrgKeyData[org.id] = {
        type: "organization",
        key: org.key,
      };
    });

    providerOrgs.forEach((org) => {
      encOrgKeyData[org.id] = {
        type: "provider",
        providerId: org.providerId,
        key: org.key,
      };
    });

    await this.stateService.setDecryptedOrganizationKeys(null);
    return await this.stateService.setEncryptedOrganizationKeys(encOrgKeyData);
  }

  async setProviderKeys(providers: ProfileProviderResponse[]): Promise<void> {
    const providerKeys: any = {};
    providers.forEach((provider) => {
      providerKeys[provider.id] = provider.key;
    });

    await this.stateService.setDecryptedProviderKeys(null);
    return await this.stateService.setEncryptedProviderKeys(providerKeys);
  }

  async getKey(keySuffix?: KeySuffixOptions, userId?: string): Promise<SymmetricCryptoKey> {
    const inMemoryKey = await this.stateService.getCryptoMasterKey({ userId: userId });

    if (inMemoryKey != null) {
      return inMemoryKey;
    }

    keySuffix ||= KeySuffixOptions.Auto;
    const symmetricKey = await this.getKeyFromStorage(keySuffix, userId);

    if (symmetricKey != null) {
      // TODO: Refactor here so get key doesn't also set key
      this.setKey(symmetricKey, userId);
    }

    return symmetricKey;
  }

  async getKeyFromStorage(
    keySuffix: KeySuffixOptions,
    userId?: string
  ): Promise<SymmetricCryptoKey> {
    const key = await this.retrieveKeyFromStorage(keySuffix, userId);
    if (key != null) {
      const symmetricKey = new SymmetricCryptoKey(Utils.fromB64ToArray(key));

      if (!(await this.validateKey(symmetricKey))) {
        this.logService.warning("Wrong key, throwing away stored key");
        await this.clearSecretKeyStore(userId);
        return null;
      }

      return symmetricKey;
    }
    return null;
  }

  async getKeyHash(): Promise<string> {
    return await this.stateService.getKeyHash();
  }

  async compareAndUpdateKeyHash(masterPassword: string, key: SymmetricCryptoKey): Promise<boolean> {
    const storedKeyHash = await this.getKeyHash();
    if (masterPassword != null && storedKeyHash != null) {
      const localKeyHash = await this.hashPassword(
        masterPassword,
        key,
        HashPurpose.LocalAuthorization
      );
      if (localKeyHash != null && storedKeyHash === localKeyHash) {
        return true;
      }

      // TODO: remove serverKeyHash check in 1-2 releases after everyone's keyHash has been updated
      const serverKeyHash = await this.hashPassword(
        masterPassword,
        key,
        HashPurpose.ServerAuthorization
      );
      if (serverKeyHash != null && storedKeyHash === serverKeyHash) {
        await this.setKeyHash(localKeyHash);
        return true;
      }
    }

    return false;
  }

  @sequentialize(() => "getEncKey")
  getEncKey(key: SymmetricCryptoKey = null): Promise<SymmetricCryptoKey> {
    return this.getEncKeyHelper(key);
  }

  async getPublicKey(): Promise<Uint8Array> {
    const inMemoryPublicKey = await this.stateService.getPublicKey();
    if (inMemoryPublicKey != null) {
      return inMemoryPublicKey;
    }

    const privateKey = await this.getPrivateKey();
    if (privateKey == null) {
      return null;
    }

    const publicKey = await this.cryptoFunctionService.rsaExtractPublicKey(privateKey);
    await this.stateService.setPublicKey(publicKey);
    return publicKey;
  }

  async getPrivateKey(): Promise<Uint8Array> {
    const decryptedPrivateKey = await this.stateService.getDecryptedPrivateKey();
    if (decryptedPrivateKey != null) {
      return decryptedPrivateKey;
    }

    const encPrivateKey = await this.stateService.getEncryptedPrivateKey();
    if (encPrivateKey == null) {
      return null;
    }

    const privateKey = await this.decryptToBytes(new EncString(encPrivateKey), null);
    await this.stateService.setDecryptedPrivateKey(privateKey);
    return privateKey;
  }

  async getFingerprint(fingerprintMaterial: string, publicKey?: Uint8Array): Promise<string[]> {
    if (publicKey == null) {
      publicKey = await this.getPublicKey();
    }
    if (publicKey === null) {
      throw new Error("No public key available.");
    }
    const keyFingerprint = await this.cryptoFunctionService.hash(publicKey, "sha256");
    const userFingerprint = await this.cryptoFunctionService.hkdfExpand(
      keyFingerprint,
      fingerprintMaterial,
      32,
      "sha256"
    );
    return this.hashPhrase(userFingerprint);
  }

  @sequentialize(() => "getOrgKeys")
  async getOrgKeys(): Promise<Map<string, SymmetricCryptoKey>> {
    const result: Map<string, SymmetricCryptoKey> = new Map<string, SymmetricCryptoKey>();
    const decryptedOrganizationKeys = await this.stateService.getDecryptedOrganizationKeys();
    if (decryptedOrganizationKeys != null && decryptedOrganizationKeys.size > 0) {
      return decryptedOrganizationKeys;
    }

    const encOrgKeyData = await this.stateService.getEncryptedOrganizationKeys();
    if (encOrgKeyData == null) {
      return null;
    }

    let setKey = false;

    for (const orgId of Object.keys(encOrgKeyData)) {
      if (result.has(orgId)) {
        continue;
      }

      const encOrgKey = BaseEncryptedOrganizationKey.fromData(encOrgKeyData[orgId]);
      const decOrgKey = await encOrgKey.decrypt(this);
      result.set(orgId, decOrgKey);

      setKey = true;
    }

    if (setKey) {
      await this.stateService.setDecryptedOrganizationKeys(result);
    }

    return result;
  }

  async getOrgKey(orgId: string): Promise<SymmetricCryptoKey> {
    if (orgId == null) {
      return null;
    }

    const orgKeys = await this.getOrgKeys();
    if (orgKeys == null || !orgKeys.has(orgId)) {
      return null;
    }

    return orgKeys.get(orgId);
  }

  @sequentialize(() => "getProviderKeys")
  async getProviderKeys(): Promise<Map<string, SymmetricCryptoKey>> {
    const providerKeys: Map<string, SymmetricCryptoKey> = new Map<string, SymmetricCryptoKey>();
    const decryptedProviderKeys = await this.stateService.getDecryptedProviderKeys();
    if (decryptedProviderKeys != null && decryptedProviderKeys.size > 0) {
      return decryptedProviderKeys;
    }

    const encProviderKeys = await this.stateService.getEncryptedProviderKeys();
    if (encProviderKeys == null) {
      return null;
    }

    let setKey = false;

    for (const orgId in encProviderKeys) {
      // eslint-disable-next-line
      if (!encProviderKeys.hasOwnProperty(orgId)) {
        continue;
      }

      const decValue = await this.rsaDecrypt(encProviderKeys[orgId]);
      providerKeys.set(orgId, new SymmetricCryptoKey(decValue));
      setKey = true;
    }

    if (setKey) {
      await this.stateService.setDecryptedProviderKeys(providerKeys);
    }

    return providerKeys;
  }

  async getProviderKey(providerId: string): Promise<SymmetricCryptoKey> {
    if (providerId == null) {
      return null;
    }

    const providerKeys = await this.getProviderKeys();
    if (providerKeys == null || !providerKeys.has(providerId)) {
      return null;
    }

    return providerKeys.get(providerId);
  }

  async hasKey(): Promise<boolean> {
    return (
      (await this.hasKeyInMemory()) ||
      (await this.hasKeyStored(KeySuffixOptions.Auto)) ||
      (await this.hasKeyStored(KeySuffixOptions.Biometric))
    );
  }

  async hasKeyInMemory(userId?: string): Promise<boolean> {
    return (await this.stateService.getCryptoMasterKey({ userId: userId })) != null;
  }

  async hasKeyStored(keySuffix: KeySuffixOptions, userId?: string): Promise<boolean> {
    switch (keySuffix) {
      case KeySuffixOptions.Auto:
        return (await this.stateService.getCryptoMasterKeyAuto({ userId: userId })) != null;
      case KeySuffixOptions.Biometric:
        return (await this.stateService.hasCryptoMasterKeyBiometric({ userId: userId })) === true;
      default:
        return false;
    }
  }

  async hasEncKey(): Promise<boolean> {
    return (await this.stateService.getEncryptedCryptoSymmetricKey()) != null;
  }

  async clearKey(clearSecretStorage = true, userId?: string): Promise<any> {
    await this.stateService.setCryptoMasterKey(null, { userId: userId });
    if (clearSecretStorage) {
      await this.clearSecretKeyStore(userId);
    }
  }

  async clearStoredKey(keySuffix: KeySuffixOptions) {
    keySuffix === KeySuffixOptions.Auto
      ? await this.stateService.setCryptoMasterKeyAuto(null)
      : await this.stateService.setCryptoMasterKeyBiometric(null);
  }

  async clearKeyHash(userId?: string): Promise<any> {
    return await this.stateService.setKeyHash(null, { userId: userId });
  }

  async clearEncKey(memoryOnly?: boolean, userId?: string): Promise<void> {
    await this.stateService.setDecryptedCryptoSymmetricKey(null, { userId: userId });
    if (!memoryOnly) {
      await this.stateService.setEncryptedCryptoSymmetricKey(null, { userId: userId });
    }
  }

  async clearKeyPair(memoryOnly?: boolean, userId?: string): Promise<any> {
    const keysToClear: Promise<void>[] = [
      this.stateService.setDecryptedPrivateKey(null, { userId: userId }),
      this.stateService.setPublicKey(null, { userId: userId }),
    ];
    if (!memoryOnly) {
      keysToClear.push(this.stateService.setEncryptedPrivateKey(null, { userId: userId }));
    }
    return Promise.all(keysToClear);
  }

  async clearOrgKeys(memoryOnly?: boolean, userId?: string): Promise<void> {
    await this.stateService.setDecryptedOrganizationKeys(null, { userId: userId });
    if (!memoryOnly) {
      await this.stateService.setEncryptedOrganizationKeys(null, { userId: userId });
    }
  }

  async clearProviderKeys(memoryOnly?: boolean, userId?: string): Promise<void> {
    await this.stateService.setDecryptedProviderKeys(null, { userId: userId });
    if (!memoryOnly) {
      await this.stateService.setEncryptedProviderKeys(null, { userId: userId });
    }
  }

  async clearPinProtectedKey(userId?: string): Promise<any> {
    return await this.stateService.setEncryptedPinProtected(null, { userId: userId });
  }

  async clearKeys(userId?: string): Promise<any> {
    await this.clearKey(true, userId);
    await this.clearKeyHash(userId);
    await this.clearOrgKeys(false, userId);
    await this.clearProviderKeys(false, userId);
    await this.clearEncKey(false, userId);
    await this.clearKeyPair(false, userId);
    await this.clearPinProtectedKey(userId);
  }

  async toggleKey(): Promise<any> {
    const key = await this.getKey();

    await this.setKey(key);
  }

  async makeKey(
    password: string,
    salt: string,
    kdf: KdfType,
    kdfConfig: KdfConfig
  ): Promise<SymmetricCryptoKey> {
    let key: Uint8Array = null;
    if (kdf == null || kdf === KdfType.PBKDF2_SHA256) {
      if (kdfConfig.iterations == null) {
        kdfConfig.iterations = 5000;
      } else if (kdfConfig.iterations < 5000) {
        throw new Error("PBKDF2 iteration minimum is 5000.");
      }
      key = await this.cryptoFunctionService.pbkdf2(password, salt, "sha256", kdfConfig.iterations);
    } else if (kdf == KdfType.Argon2id) {
      if (kdfConfig.iterations == null) {
        kdfConfig.iterations = DEFAULT_ARGON2_ITERATIONS;
      } else if (kdfConfig.iterations < 2) {
        throw new Error("Argon2 iteration minimum is 2.");
      }

      if (kdfConfig.memory == null) {
        kdfConfig.memory = DEFAULT_ARGON2_MEMORY;
      } else if (kdfConfig.memory < 16) {
        throw new Error("Argon2 memory minimum is 16 MB");
      } else if (kdfConfig.memory > 1024) {
        throw new Error("Argon2 memory maximum is 1024 MB");
      }

      if (kdfConfig.parallelism == null) {
        kdfConfig.parallelism = DEFAULT_ARGON2_PARALLELISM;
      } else if (kdfConfig.parallelism < 1) {
        throw new Error("Argon2 parallelism minimum is 1.");
      }

      const saltHash = await this.cryptoFunctionService.hash(salt, "sha256");
      key = await this.cryptoFunctionService.argon2(
        password,
        saltHash,
        kdfConfig.iterations,
        kdfConfig.memory * 1024, // convert to KiB from MiB
        kdfConfig.parallelism
      );
    } else {
      throw new Error("Unknown Kdf.");
    }
    return new SymmetricCryptoKey(key);
  }

  async makeKeyFromPin(
    pin: string,
    salt: string,
    kdf: KdfType,
    kdfConfig: KdfConfig,
    protectedKeyCs: EncString = null
  ): Promise<SymmetricCryptoKey> {
    if (protectedKeyCs == null) {
      const pinProtectedKey = await this.stateService.getEncryptedPinProtected();
      if (pinProtectedKey == null) {
        throw new Error("No PIN protected key found.");
      }
      protectedKeyCs = new EncString(pinProtectedKey);
    }
    const pinKey = await this.makePinKey(pin, salt, kdf, kdfConfig);
    const decKey = await this.decryptToBytes(protectedKeyCs, pinKey);
    return new SymmetricCryptoKey(decKey);
  }

  async makeShareKey(): Promise<[EncString, SymmetricCryptoKey]> {
    const shareKey = await this.cryptoFunctionService.randomBytes(64);
    const publicKey = await this.getPublicKey();
    const encShareKey = await this.rsaEncrypt(shareKey, publicKey);
    return [encShareKey, new SymmetricCryptoKey(shareKey)];
  }

  async makeKeyPair(key?: SymmetricCryptoKey): Promise<[string, EncString]> {
    const keyPair = await this.cryptoFunctionService.rsaGenerateKeyPair(2048);
    const publicB64 = Utils.fromBufferToB64(keyPair[0]);
    const privateEnc = await this.encrypt(keyPair[1], key);
    return [publicB64, privateEnc];
  }

  async makePinKey(
    pin: string,
    salt: string,
    kdf: KdfType,
    kdfConfig: KdfConfig
  ): Promise<SymmetricCryptoKey> {
    const pinKey = await this.makeKey(pin, salt, kdf, kdfConfig);
    return await this.stretchKey(pinKey);
  }

  async makeSendKey(keyMaterial: Uint8Array): Promise<SymmetricCryptoKey> {
    const sendKey = await this.cryptoFunctionService.hkdf(
      keyMaterial,
      "bitwarden-send",
      "send",
      64,
      "sha256"
    );
    return new SymmetricCryptoKey(sendKey);
  }

  async hashPassword(
    password: string,
    key: SymmetricCryptoKey,
    hashPurpose?: HashPurpose
  ): Promise<string> {
    if (key == null) {
      key = await this.getKey();
    }
    if (password == null || key == null) {
      throw new Error("Invalid parameters.");
    }

    const iterations = hashPurpose === HashPurpose.LocalAuthorization ? 2 : 1;
    const hash = await this.cryptoFunctionService.pbkdf2(key.key, password, "sha256", iterations);
    return Utils.fromBufferToB64(hash);
  }

  async makeEncKey(key: SymmetricCryptoKey): Promise<[SymmetricCryptoKey, EncString]> {
    const theKey = await this.getKeyForUserEncryption(key);
    const encKey = await this.cryptoFunctionService.randomBytes(64);
    return this.buildEncKey(theKey, encKey);
  }

  async remakeEncKey(
    key: SymmetricCryptoKey,
    encKey?: SymmetricCryptoKey
  ): Promise<[SymmetricCryptoKey, EncString]> {
    if (encKey == null) {
      encKey = await this.getEncKey();
    }
    return this.buildEncKey(key, encKey.key);
  }

  /**
   * @deprecated July 25 2022: Get the key you need from CryptoService (getKeyForUserEncryption or getOrgKey)
   * and then call encryptService.encrypt
   */
  async encrypt(plainValue: string | Uint8Array, key?: SymmetricCryptoKey): Promise<EncString> {
    key = await this.getKeyForUserEncryption(key);
    return await this.encryptService.encrypt(plainValue, key);
  }

  /**
   * @deprecated July 25 2022: Get the key you need from CryptoService (getKeyForUserEncryption or getOrgKey)
   * and then call encryptService.encryptToBytes
   */
  async encryptToBytes(plainValue: Uint8Array, key?: SymmetricCryptoKey): Promise<EncArrayBuffer> {
    key = await this.getKeyForUserEncryption(key);
    return this.encryptService.encryptToBytes(plainValue, key);
  }

  async rsaEncrypt(data: Uint8Array, publicKey?: Uint8Array): Promise<EncString> {
    if (publicKey == null) {
      publicKey = await this.getPublicKey();
    }
    if (publicKey == null) {
      throw new Error("Public key unavailable.");
    }

    const encBytes = await this.cryptoFunctionService.rsaEncrypt(data, publicKey, "sha1");
    return new EncString(EncryptionType.Rsa2048_OaepSha1_B64, Utils.fromBufferToB64(encBytes));
  }

  async rsaDecrypt(encValue: string, privateKeyValue?: Uint8Array): Promise<Uint8Array> {
    const headerPieces = encValue.split(".");
    let encType: EncryptionType = null;
    let encPieces: string[];

    if (headerPieces.length === 1) {
      encType = EncryptionType.Rsa2048_OaepSha256_B64;
      encPieces = [headerPieces[0]];
    } else if (headerPieces.length === 2) {
      try {
        encType = parseInt(headerPieces[0], null);
        encPieces = headerPieces[1].split("|");
      } catch (e) {
        this.logService.error(e);
      }
    }

    switch (encType) {
      case EncryptionType.Rsa2048_OaepSha256_B64:
      case EncryptionType.Rsa2048_OaepSha1_B64:
      case EncryptionType.Rsa2048_OaepSha256_HmacSha256_B64: // HmacSha256 types are deprecated
      case EncryptionType.Rsa2048_OaepSha1_HmacSha256_B64:
        break;
      default:
        throw new Error("encType unavailable.");
    }

    if (encPieces == null || encPieces.length <= 0) {
      throw new Error("encPieces unavailable.");
    }

    const data = Utils.fromB64ToArray(encPieces[0]);
    const privateKey = privateKeyValue ?? (await this.getPrivateKey());
    if (privateKey == null) {
      throw new Error("No private key.");
    }

    let alg: "sha1" | "sha256" = "sha1";
    switch (encType) {
      case EncryptionType.Rsa2048_OaepSha256_B64:
      case EncryptionType.Rsa2048_OaepSha256_HmacSha256_B64:
        alg = "sha256";
        break;
      case EncryptionType.Rsa2048_OaepSha1_B64:
      case EncryptionType.Rsa2048_OaepSha1_HmacSha256_B64:
        break;
      default:
        throw new Error("encType unavailable.");
    }

    return this.cryptoFunctionService.rsaDecrypt(data, privateKey, alg);
  }

  /**
   * @deprecated July 25 2022: Get the key you need from CryptoService (getKeyForUserEncryption or getOrgKey)
   * and then call encryptService.decryptToBytes
   */
  async decryptToBytes(encString: EncString, key?: SymmetricCryptoKey): Promise<Uint8Array> {
    const keyForEnc = await this.getKeyForUserEncryption(key);
    return this.encryptService.decryptToBytes(encString, keyForEnc);
  }

  /**
   * @deprecated July 25 2022: Get the key you need from CryptoService (getKeyForUserEncryption or getOrgKey)
   * and then call encryptService.decryptToUtf8
   */
  async decryptToUtf8(encString: EncString, key?: SymmetricCryptoKey): Promise<string> {
    key = await this.getKeyForUserEncryption(key);
    return await this.encryptService.decryptToUtf8(encString, key);
  }

  /**
   * @deprecated July 25 2022: Get the key you need from CryptoService (getKeyForUserEncryption or getOrgKey)
   * and then call encryptService.decryptToBytes
   */
  async decryptFromBytes(encBuffer: EncArrayBuffer, key: SymmetricCryptoKey): Promise<Uint8Array> {
    if (encBuffer == null) {
      throw new Error("No buffer provided for decryption.");
    }

    key = await this.getKeyForUserEncryption(key);

    return this.encryptService.decryptToBytes(encBuffer, key);
  }

  // EFForg/OpenWireless
  // ref https://github.com/EFForg/OpenWireless/blob/master/app/js/diceware.js
  async randomNumber(min: number, max: number): Promise<number> {
    let rval = 0;
    const range = max - min + 1;
    const bitsNeeded = Math.ceil(Math.log2(range));
    if (bitsNeeded > 53) {
      throw new Error("We cannot generate numbers larger than 53 bits.");
    }

    const bytesNeeded = Math.ceil(bitsNeeded / 8);
    const mask = Math.pow(2, bitsNeeded) - 1;
    // 7776 -> (2^13 = 8192) -1 == 8191 or 0x00001111 11111111

    // Fill a byte array with N random numbers
    const byteArray = new Uint8Array(await this.cryptoFunctionService.randomBytes(bytesNeeded));

    let p = (bytesNeeded - 1) * 8;
    for (let i = 0; i < bytesNeeded; i++) {
      rval += byteArray[i] * Math.pow(2, p);
      p -= 8;
    }

    // Use & to apply the mask and reduce the number of recursive lookups
    rval = rval & mask;

    if (rval >= range) {
      // Integer out of acceptable range
      return this.randomNumber(min, max);
    }

    // Return an integer that falls within the range
    return min + rval;
  }

  async validateKey(key: SymmetricCryptoKey) {
    try {
      const encPrivateKey = await this.stateService.getEncryptedPrivateKey();
      const encKey = await this.getEncKeyHelper(key);
      if (encPrivateKey == null || encKey == null) {
        return false;
      }

      const privateKey = await this.decryptToBytes(new EncString(encPrivateKey), encKey);
      await this.cryptoFunctionService.rsaExtractPublicKey(privateKey);
    } catch (e) {
      return false;
    }

    return true;
  }

  // ---HELPERS---

  protected async storeKey(key: SymmetricCryptoKey, userId?: string) {
    const storeAuto = await this.shouldStoreKey(KeySuffixOptions.Auto, userId);

    if (storeAuto) {
      await this.storeAutoKey(key, userId);
    } else {
      await this.stateService.setCryptoMasterKeyAuto(null, { userId: userId });
    }
  }

  protected async storeAutoKey(key: SymmetricCryptoKey, userId?: string) {
    await this.stateService.setCryptoMasterKeyAuto(key.keyB64, { userId: userId });
  }

  protected async shouldStoreKey(keySuffix: KeySuffixOptions, userId?: string) {
    let shouldStoreKey = false;
    if (keySuffix === KeySuffixOptions.Auto) {
      const vaultTimeout = await this.stateService.getVaultTimeout({ userId: userId });
      shouldStoreKey = vaultTimeout == null;
    } else if (keySuffix === KeySuffixOptions.Biometric) {
      const biometricUnlock = await this.stateService.getBiometricUnlock({ userId: userId });
      shouldStoreKey = biometricUnlock && this.platformUtilService.supportsSecureStorage();
    }
    return shouldStoreKey;
  }

  protected async retrieveKeyFromStorage(keySuffix: KeySuffixOptions, userId?: string) {
    return keySuffix === KeySuffixOptions.Auto
      ? await this.stateService.getCryptoMasterKeyAuto({ userId: userId })
      : await this.stateService.getCryptoMasterKeyBiometric({ userId: userId });
  }

  async getKeyForUserEncryption(key?: SymmetricCryptoKey): Promise<SymmetricCryptoKey> {
    if (key != null) {
      return key;
    }

    const encKey = await this.getEncKey();
    if (encKey != null) {
      return encKey;
    }

    // Legacy support: encryption used to be done with the user key (derived from master password).
    // Users who have not migrated will have a null encKey and must use the user key instead.
    return await this.getKey();
  }

  private async stretchKey(key: SymmetricCryptoKey): Promise<SymmetricCryptoKey> {
    const newKey = new Uint8Array(64);
    const encKey = await this.cryptoFunctionService.hkdfExpand(key.key, "enc", 32, "sha256");
    const macKey = await this.cryptoFunctionService.hkdfExpand(key.key, "mac", 32, "sha256");
    newKey.set(new Uint8Array(encKey));
    newKey.set(new Uint8Array(macKey), 32);
    return new SymmetricCryptoKey(newKey);
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

  private async buildEncKey(
    key: SymmetricCryptoKey,
    encKey: Uint8Array
  ): Promise<[SymmetricCryptoKey, EncString]> {
    let encKeyEnc: EncString = null;
    if (key.key.byteLength === 32) {
      const newKey = await this.stretchKey(key);
      encKeyEnc = await this.encrypt(encKey, newKey);
    } else if (key.key.byteLength === 64) {
      encKeyEnc = await this.encrypt(encKey, key);
    } else {
      throw new Error("Invalid key size.");
    }
    return [new SymmetricCryptoKey(encKey), encKeyEnc];
  }

  private async clearSecretKeyStore(userId?: string): Promise<void> {
    await this.stateService.setCryptoMasterKeyAuto(null, { userId: userId });
    await this.stateService.setCryptoMasterKeyBiometric(null, { userId: userId });
  }

  private async getEncKeyHelper(key: SymmetricCryptoKey = null): Promise<SymmetricCryptoKey> {
    const inMemoryKey = await this.stateService.getDecryptedCryptoSymmetricKey();
    if (inMemoryKey != null) {
      return inMemoryKey;
    }

    const encKey = await this.stateService.getEncryptedCryptoSymmetricKey();
    if (encKey == null) {
      return null;
    }

    if (key == null) {
      key = await this.getKey();
    }
    if (key == null) {
      return null;
    }

    let decEncKey: Uint8Array;
    const encKeyCipher = new EncString(encKey);
    if (encKeyCipher.encryptionType === EncryptionType.AesCbc256_B64) {
      decEncKey = await this.decryptToBytes(encKeyCipher, key);
    } else if (encKeyCipher.encryptionType === EncryptionType.AesCbc256_HmacSha256_B64) {
      const newKey = await this.stretchKey(key);
      decEncKey = await this.decryptToBytes(encKeyCipher, newKey);
    } else {
      throw new Error("Unsupported encKey type.");
    }
    if (decEncKey == null) {
      return null;
    }
    const symmetricCryptoKey = new SymmetricCryptoKey(decEncKey);
    await this.stateService.setDecryptedCryptoSymmetricKey(symmetricCryptoKey);
    return symmetricCryptoKey;
  }
}
