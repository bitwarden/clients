import * as bigInt from "big-integer";
import {
  NEVER,
  Observable,
  combineLatest,
  firstValueFrom,
  forkJoin,
  map,
  of,
  switchMap,
} from "rxjs";

import { PinServiceAbstraction } from "../../../../auth/src/common/abstractions";
import { EncryptedOrganizationKeyData } from "../../admin-console/models/data/encrypted-organization-key.data";
import { BaseEncryptedOrganizationKey } from "../../admin-console/models/domain/encrypted-organization-key";
import { ProfileOrganizationResponse } from "../../admin-console/models/response/profile-organization.response";
import { ProfileProviderOrganizationResponse } from "../../admin-console/models/response/profile-provider-organization.response";
import { ProfileProviderResponse } from "../../admin-console/models/response/profile-provider.response";
import { AccountService } from "../../auth/abstractions/account.service";
import { KdfConfigService } from "../../auth/abstractions/kdf-config.service";
import { InternalMasterPasswordServiceAbstraction } from "../../auth/abstractions/master-password.service.abstraction";
import { KdfConfig } from "../../auth/models/domain/kdf-config";
import { Utils } from "../../platform/misc/utils";
import { VAULT_TIMEOUT } from "../../services/vault-timeout/vault-timeout-settings.state";
import { CsprngArray } from "../../types/csprng";
import { OrganizationId, ProviderId, UserId } from "../../types/guid";
import {
  OrgKey,
  UserKey,
  MasterKey,
  ProviderKey,
  CipherKey,
  UserPrivateKey,
  UserPublicKey,
} from "../../types/key";
import { VaultTimeoutStringType } from "../../types/vault-timeout.type";
import { CryptoFunctionService } from "../abstractions/crypto-function.service";
import {
  CipherDecryptionKeys,
  CryptoService as CryptoServiceAbstraction,
} from "../abstractions/crypto.service";
import { EncryptService } from "../abstractions/encrypt.service";
import { KeyGenerationService } from "../abstractions/key-generation.service";
import { LogService } from "../abstractions/log.service";
import { PlatformUtilsService } from "../abstractions/platform-utils.service";
import { StateService } from "../abstractions/state.service";
import { KeySuffixOptions, HashPurpose, EncryptionType } from "../enums";
import { convertValues } from "../misc/convert-values";
import { EFFLongWordList } from "../misc/wordlist";
import { EncArrayBuffer } from "../models/domain/enc-array-buffer";
import { EncString, EncryptedString } from "../models/domain/enc-string";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";
import { ActiveUserState, StateProvider } from "../state";

import { USER_ENCRYPTED_ORGANIZATION_KEYS } from "./key-state/org-keys.state";
import { USER_ENCRYPTED_PROVIDER_KEYS } from "./key-state/provider-keys.state";
import {
  USER_ENCRYPTED_PRIVATE_KEY,
  USER_EVER_HAD_USER_KEY,
  USER_KEY,
} from "./key-state/user-key.state";

export class CryptoService implements CryptoServiceAbstraction {
  private readonly activeUserEverHadUserKey: ActiveUserState<boolean>;

  readonly everHadUserKey$: Observable<boolean>;

  readonly activeUserOrgKeys$: Observable<Record<OrganizationId, OrgKey>>;

  constructor(
    protected pinService: PinServiceAbstraction,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected keyGenerationService: KeyGenerationService,
    protected cryptoFunctionService: CryptoFunctionService,
    protected encryptService: EncryptService,
    protected platformUtilService: PlatformUtilsService,
    protected logService: LogService,
    protected stateService: StateService,
    protected accountService: AccountService,
    protected stateProvider: StateProvider,
    protected kdfConfigService: KdfConfigService,
  ) {
    // User Key
    this.activeUserEverHadUserKey = stateProvider.getActive(USER_EVER_HAD_USER_KEY);
    this.everHadUserKey$ = this.activeUserEverHadUserKey.state$.pipe(map((x) => x ?? false));

    this.activeUserOrgKeys$ = this.stateProvider.activeUserId$.pipe(
      switchMap((userId) => (userId != null ? this.orgKeys$(userId) : NEVER)),
    );
  }

  async setUserKey(key: UserKey, userId?: UserId): Promise<void> {
    if (key == null) {
      throw new Error("No key provided. Lock the user to clear the key");
    }
    // Set userId to ensure we have one for the account status update
    [userId, key] = await this.stateProvider.setUserState(USER_KEY, key, userId);
    await this.stateProvider.setUserState(USER_EVER_HAD_USER_KEY, true, userId);

    await this.storeAdditionalKeys(key, userId);
  }

  async refreshAdditionalKeys(): Promise<void> {
    const activeUserId = await firstValueFrom(this.stateProvider.activeUserId$);

    if (activeUserId == null) {
      throw new Error("Can only refresh keys while there is an active user.");
    }

    const key = await this.getUserKey(activeUserId);
    await this.setUserKey(key, activeUserId);
  }

  getInMemoryUserKeyFor$(userId: UserId): Observable<UserKey> {
    return this.stateProvider.getUserState$(USER_KEY, userId);
  }

  async getUserKey(userId?: UserId): Promise<UserKey> {
    const userKey = await firstValueFrom(this.stateProvider.getUserState$(USER_KEY, userId));
    return userKey;
  }

  async isLegacyUser(masterKey?: MasterKey, userId?: UserId): Promise<boolean> {
    userId ??= await firstValueFrom(this.stateProvider.activeUserId$);
    masterKey ??= await firstValueFrom(this.masterPasswordService.masterKey$(userId));

    return await this.validateUserKey(masterKey as unknown as UserKey, userId);
  }

  // TODO: legacy support for user key is no longer needed since we require users to migrate on login
  async getUserKeyWithLegacySupport(userId?: UserId): Promise<UserKey> {
    userId ??= await firstValueFrom(this.stateProvider.activeUserId$);

    const userKey = await this.getUserKey(userId);
    if (userKey) {
      return userKey;
    }

    // Legacy support: encryption used to be done with the master key (derived from master password).
    // Users who have not migrated will have a null user key and must use the master key instead.
    const masterKey = await firstValueFrom(this.masterPasswordService.masterKey$(userId));
    return masterKey as unknown as UserKey;
  }

  async getUserKeyFromStorage(keySuffix: KeySuffixOptions, userId?: UserId): Promise<UserKey> {
    userId ??= await firstValueFrom(this.stateProvider.activeUserId$);
    const userKey = await this.getKeyFromStorage(keySuffix, userId);
    if (userKey) {
      if (!(await this.validateUserKey(userKey, userId))) {
        this.logService.warning("Invalid key, throwing away stored keys");
        await this.clearAllStoredUserKeys(userId);
      }
      return userKey;
    }
  }

  async hasUserKey(userId?: UserId): Promise<boolean> {
    userId ??= await firstValueFrom(this.stateProvider.activeUserId$);
    if (userId == null) {
      return false;
    }
    return await this.hasUserKeyInMemory(userId);
  }

  async hasUserKeyInMemory(userId?: UserId): Promise<boolean> {
    userId ??= await firstValueFrom(this.stateProvider.activeUserId$);
    if (userId == null) {
      return false;
    }

    return (await firstValueFrom(this.stateProvider.getUserState$(USER_KEY, userId))) != null;
  }

  async hasUserKeyStored(keySuffix: KeySuffixOptions, userId?: UserId): Promise<boolean> {
    return (await this.getKeyFromStorage(keySuffix, userId)) != null;
  }

  async makeUserKey(masterKey: MasterKey): Promise<[UserKey, EncString]> {
    if (!masterKey) {
      const userId = await firstValueFrom(this.stateProvider.activeUserId$);
      masterKey = await firstValueFrom(this.masterPasswordService.masterKey$(userId));
    }
    if (masterKey == null) {
      throw new Error("No Master Key found.");
    }

    const newUserKey = await this.keyGenerationService.createKey(512);
    return this.buildProtectedSymmetricKey(masterKey, newUserKey.key);
  }

  /**
   * Clears the user key. Clears all stored versions of the user keys as well, such as the biometrics key
   * @param userId The desired user
   */
  private async clearUserKey(userId: UserId): Promise<void> {
    if (userId == null) {
      // nothing to do
      return;
    }
    // Set userId to ensure we have one for the account status update
    await this.stateProvider.setUserState(USER_KEY, null, userId);
    await this.clearAllStoredUserKeys(userId);
  }

  async clearStoredUserKey(keySuffix: KeySuffixOptions, userId?: UserId): Promise<void> {
    if (keySuffix === KeySuffixOptions.Auto) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.stateService.setUserKeyAutoUnlock(null, { userId: userId });
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.clearDeprecatedKeys(KeySuffixOptions.Auto, userId);
    }
    if (keySuffix === KeySuffixOptions.Pin) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.pinService.clearPinKeyEncryptedUserKeyEphemeral(userId);
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.clearDeprecatedKeys(KeySuffixOptions.Pin, userId);
    }
  }

  async setMasterKeyEncryptedUserKey(userKeyMasterKey: string, userId?: UserId): Promise<void> {
    userId ??= await firstValueFrom(this.stateProvider.activeUserId$);
    await this.masterPasswordService.setMasterKeyEncryptedUserKey(
      new EncString(userKeyMasterKey),
      userId,
    );
  }

  // TODO: Move to MasterPasswordService
  async getOrDeriveMasterKey(password: string, userId?: UserId) {
    const [resolvedUserId, email] = await firstValueFrom(
      combineLatest([this.accountService.activeAccount$, this.accountService.accounts$]).pipe(
        map(([activeAccount, accounts]) => {
          userId ??= activeAccount?.id;
          return [userId, accounts[userId]?.email];
        }),
      ),
    );
    let masterKey = await firstValueFrom(this.masterPasswordService.masterKey$(resolvedUserId));
    return (masterKey ||= await this.makeMasterKey(
      password,
      email,
      await this.kdfConfigService.getKdfConfig(),
    ));
  }

  /**
   * Derive a master key from a password and email.
   *
   * @remarks
   * Does not validate the kdf config to ensure it satisfies the minimum requirements for the given kdf type.
   * TODO: Move to MasterPasswordService
   */
  async makeMasterKey(password: string, email: string, KdfConfig: KdfConfig): Promise<MasterKey> {
    return (await this.keyGenerationService.deriveKeyFromPassword(
      password,
      email,
      KdfConfig,
    )) as MasterKey;
  }

  async encryptUserKeyWithMasterKey(
    masterKey: MasterKey,
    userKey?: UserKey,
  ): Promise<[UserKey, EncString]> {
    userKey ||= await this.getUserKey();
    return await this.buildProtectedSymmetricKey(masterKey, userKey.key);
  }

  // TODO: move to MasterPasswordService
  async hashMasterKey(
    password: string,
    key: MasterKey,
    hashPurpose?: HashPurpose,
  ): Promise<string> {
    if (!key) {
      const userId = await firstValueFrom(this.stateProvider.activeUserId$);
      key = await firstValueFrom(this.masterPasswordService.masterKey$(userId));
    }

    if (password == null || key == null) {
      throw new Error("Invalid parameters.");
    }

    const iterations = hashPurpose === HashPurpose.LocalAuthorization ? 2 : 1;
    const hash = await this.cryptoFunctionService.pbkdf2(key.key, password, "sha256", iterations);
    return Utils.fromBufferToB64(hash);
  }

  // TODO: move to MasterPasswordService
  async compareAndUpdateKeyHash(masterPassword: string, masterKey: MasterKey): Promise<boolean> {
    const userId = await firstValueFrom(this.stateProvider.activeUserId$);
    const storedPasswordHash = await firstValueFrom(
      this.masterPasswordService.masterKeyHash$(userId),
    );
    if (masterPassword != null && storedPasswordHash != null) {
      const localKeyHash = await this.hashMasterKey(
        masterPassword,
        masterKey,
        HashPurpose.LocalAuthorization,
      );
      if (localKeyHash != null && storedPasswordHash === localKeyHash) {
        return true;
      }

      // TODO: remove serverKeyHash check in 1-2 releases after everyone's keyHash has been updated
      const serverKeyHash = await this.hashMasterKey(
        masterPassword,
        masterKey,
        HashPurpose.ServerAuthorization,
      );
      if (serverKeyHash != null && storedPasswordHash === serverKeyHash) {
        await this.masterPasswordService.setMasterKeyHash(localKeyHash, userId);
        return true;
      }
    }

    return false;
  }

  async setOrgKeys(
    orgs: ProfileOrganizationResponse[],
    providerOrgs: ProfileProviderOrganizationResponse[],
    userId: UserId,
  ): Promise<void> {
    await this.stateProvider.getUser(userId, USER_ENCRYPTED_ORGANIZATION_KEYS).update(() => {
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

      return encOrgKeyData;
    });
  }

  async getOrgKey(orgId: OrganizationId): Promise<OrgKey> {
    const activeUserId = await firstValueFrom(this.stateProvider.activeUserId$);
    if (activeUserId == null) {
      throw new Error("A user must be active to retrieve an org key");
    }
    const orgKeys = await firstValueFrom(this.orgKeys$(activeUserId));
    return orgKeys[orgId];
  }

  async makeDataEncKey<T extends OrgKey | UserKey>(
    key: T,
  ): Promise<[SymmetricCryptoKey, EncString]> {
    if (key == null) {
      throw new Error("No key provided");
    }

    const newSymKey = await this.keyGenerationService.createKey(512);
    return this.buildProtectedSymmetricKey(key, newSymKey.key);
  }

  private async clearOrgKeys(userId: UserId): Promise<void> {
    if (userId == null) {
      // nothing to do
      return;
    }
    await this.stateProvider.setUserState(USER_ENCRYPTED_ORGANIZATION_KEYS, null, userId);
  }

  async setProviderKeys(providers: ProfileProviderResponse[], userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, USER_ENCRYPTED_PROVIDER_KEYS).update(() => {
      const encProviderKeys: { [providerId: ProviderId]: EncryptedString } = {};

      providers.forEach((provider) => {
        encProviderKeys[provider.id as ProviderId] = provider.key as EncryptedString;
      });

      return encProviderKeys;
    });
  }

  // TODO: Deprecate in favor of observable
  async getProviderKey(providerId: ProviderId): Promise<ProviderKey> {
    if (providerId == null) {
      return null;
    }

    const activeUserId = await firstValueFrom(this.stateProvider.activeUserId$);
    const providerKeys = await firstValueFrom(this.providerKeys$(activeUserId));

    return providerKeys[providerId] ?? null;
  }

  private async clearProviderKeys(userId: UserId): Promise<void> {
    if (userId == null) {
      // nothing to do
      return;
    }
    await this.stateProvider.setUserState(USER_ENCRYPTED_PROVIDER_KEYS, null, userId);
  }

  // TODO: Make userId required
  async makeOrgKey<T extends OrgKey | ProviderKey>(userId?: UserId): Promise<[EncString, T]> {
    const shareKey = await this.keyGenerationService.createKey(512);
    userId ??= await firstValueFrom(this.stateProvider.activeUserId$);
    const publicKey = await firstValueFrom(this.userPublicKey$(userId));
    const encShareKey = await this.rsaEncrypt(shareKey.key, publicKey);
    return [encShareKey, shareKey as T];
  }

  async setPrivateKey(encPrivateKey: EncryptedString, userId: UserId): Promise<void> {
    if (encPrivateKey == null) {
      return;
    }

    await this.stateProvider
      .getUser(userId, USER_ENCRYPTED_PRIVATE_KEY)
      .update(() => encPrivateKey);
  }

  async getPrivateKey(): Promise<Uint8Array> {
    const activeUserId = await firstValueFrom(this.stateProvider.activeUserId$);

    if (activeUserId == null) {
      throw new Error("User must be active while attempting to retrieve private key.");
    }

    return await firstValueFrom(this.userPrivateKey$(activeUserId));
  }

  // TODO: Make public key required
  async getFingerprint(fingerprintMaterial: string, publicKey?: Uint8Array): Promise<string[]> {
    if (publicKey == null) {
      const activeUserId = await firstValueFrom(this.stateProvider.activeUserId$);
      publicKey = await firstValueFrom(this.userPublicKey$(activeUserId));
    }

    if (publicKey === null) {
      throw new Error("No public key available.");
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
    const privateEnc = await this.encryptService.encrypt(keyPair[1], key);
    return [publicB64, privateEnc];
  }

  /**
   * Clears the user's key pair
   * @param userId The desired user
   */
  private async clearKeyPair(userId: UserId): Promise<void[]> {
    if (userId == null) {
      // nothing to do
      return;
    }

    await this.stateProvider.setUserState(USER_ENCRYPTED_PRIVATE_KEY, null, userId);
  }

  async clearPinKeys(userId?: UserId): Promise<void> {
    userId ??= await firstValueFrom(this.stateProvider.activeUserId$);

    if (userId == null) {
      throw new Error("Cannot clear PIN keys, no user Id resolved.");
    }

    await this.pinService.clearPinKeyEncryptedUserKeyPersistent(userId);
    await this.pinService.clearPinKeyEncryptedUserKeyEphemeral(userId);
    await this.pinService.clearUserKeyEncryptedPin(userId);
    await this.clearDeprecatedKeys(KeySuffixOptions.Pin, userId);
  }

  async makeSendKey(keyMaterial: CsprngArray): Promise<SymmetricCryptoKey> {
    return await this.keyGenerationService.deriveKeyFromMaterial(
      keyMaterial,
      "bitwarden-send",
      "send",
    );
  }

  async makeCipherKey(): Promise<CipherKey> {
    return (await this.keyGenerationService.createKey(512)) as CipherKey;
  }

  async clearKeys(userId?: UserId): Promise<any> {
    userId ??= await firstValueFrom(this.stateProvider.activeUserId$);

    if (userId == null) {
      throw new Error("Cannot clear keys, no user Id resolved.");
    }

    await this.masterPasswordService.clearMasterKeyHash(userId);
    await this.clearUserKey(userId);
    await this.clearOrgKeys(userId);
    await this.clearProviderKeys(userId);
    await this.clearKeyPair(userId);
    await this.clearPinKeys(userId);
    await this.stateProvider.setUserState(USER_EVER_HAD_USER_KEY, null, userId);
  }

  async rsaEncrypt(data: Uint8Array, publicKey: Uint8Array): Promise<EncString> {
    if (publicKey == null) {
      throw new Error("'publicKey' is a required parameter and must be non-null");
    }

    const encBytes = await this.cryptoFunctionService.rsaEncrypt(data, publicKey, "sha1");
    return new EncString(EncryptionType.Rsa2048_OaepSha1_B64, Utils.fromBufferToB64(encBytes));
  }

  async rsaDecrypt(encValue: string, privateKey: Uint8Array): Promise<Uint8Array> {
    if (privateKey == null) {
      throw new Error("'privateKey' is a required parameter and must be non-null");
    }

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

  // ---HELPERS---
  async validateUserKey(key: UserKey, userId: UserId): Promise<boolean> {
    if (!key) {
      return false;
    }

    try {
      const encPrivateKey = await firstValueFrom(
        this.stateProvider.getUser(userId, USER_ENCRYPTED_PRIVATE_KEY).state$,
      );

      if (encPrivateKey == null) {
        return false;
      }

      // Can decrypt private key
      const privateKey = await this.decryptPrivateKey(encPrivateKey, key);

      if (privateKey == null) {
        // failed to decrypt
        return false;
      }

      // Can successfully derive public key
      const publicKey = await this.derivePublicKey(privateKey);

      if (publicKey == null) {
        // failed to decrypt
        return false;
      }
    } catch (e) {
      return false;
    }

    return true;
  }

  /**
   * Initialize all necessary crypto keys needed for a new account.
   * Warning! This completely replaces any existing keys!
   */
  async initAccount(): Promise<{
    userKey: UserKey;
    publicKey: string;
    privateKey: EncString;
  }> {
    const activeUserId = await firstValueFrom(this.stateProvider.activeUserId$);

    if (activeUserId == null) {
      throw new Error("Cannot initilize an account if one is not active.");
    }

    // Verify user key doesn't exist
    const existingUserKey = await this.getUserKey(activeUserId);

    if (existingUserKey != null) {
      this.logService.error("Tried to initialize account with existing user key.");
      throw new Error("Cannot initialize account, keys already exist.");
    }

    const userKey = (await this.keyGenerationService.createKey(512)) as UserKey;
    const [publicKey, privateKey] = await this.makeKeyPair(userKey);
    await this.setUserKey(userKey, activeUserId);
    await this.stateProvider
      .getUser(activeUserId, USER_ENCRYPTED_PRIVATE_KEY)
      .update(() => privateKey.encryptedString);

    return {
      userKey,
      publicKey,
      privateKey,
    };
  }

  /**
   * Generates any additional keys if needed. Additional keys are
   * keys such as biometrics, auto, and pin keys.
   * Useful to make sure other keys stay in sync when the user key
   * has been rotated.
   * @param key The user key
   * @param userId The desired user
   */
  protected async storeAdditionalKeys(key: UserKey, userId?: UserId) {
    userId ??= await firstValueFrom(this.stateProvider.activeUserId$);

    if (userId == null) {
      throw new Error("Cannot store additional keys, no user Id resolved.");
    }

    const storeAuto = await this.shouldStoreKey(KeySuffixOptions.Auto, userId);
    if (storeAuto) {
      await this.stateService.setUserKeyAutoUnlock(key.keyB64, { userId: userId });
    } else {
      await this.stateService.setUserKeyAutoUnlock(null, { userId: userId });
    }
    await this.clearDeprecatedKeys(KeySuffixOptions.Auto, userId);

    const storePin = await this.shouldStoreKey(KeySuffixOptions.Pin, userId);
    if (storePin) {
      // Decrypt userKeyEncryptedPin with user key
      const pin = await this.encryptService.decryptToUtf8(
        await this.pinService.getUserKeyEncryptedPin(userId),
        key,
      );

      const pinKeyEncryptedUserKey = await this.pinService.createPinKeyEncryptedUserKey(
        pin,
        key,
        userId,
      );
      const noPreExistingPersistentKey =
        (await this.pinService.getPinKeyEncryptedUserKeyPersistent(userId)) == null;

      await this.pinService.storePinKeyEncryptedUserKey(
        pinKeyEncryptedUserKey,
        noPreExistingPersistentKey,
        userId,
      );
      // We can't always clear deprecated keys because the pin is only
      // migrated once used to unlock
      await this.clearDeprecatedKeys(KeySuffixOptions.Pin, userId);
    } else {
      await this.pinService.clearPinKeyEncryptedUserKeyPersistent(userId);
      await this.pinService.clearPinKeyEncryptedUserKeyEphemeral(userId);
    }
  }

  protected async shouldStoreKey(keySuffix: KeySuffixOptions, userId?: UserId) {
    let shouldStoreKey = false;
    switch (keySuffix) {
      case KeySuffixOptions.Auto: {
        // TODO: Sharing the UserKeyDefinition is temporary to get around a circ dep issue between
        // the VaultTimeoutSettingsSvc and this service.
        // This should be fixed as part of the PM-7082 - Auto Key Service work.
        const vaultTimeout = await firstValueFrom(
          this.stateProvider.getUserState$(VAULT_TIMEOUT, userId),
        );

        shouldStoreKey = vaultTimeout == VaultTimeoutStringType.Never;
        break;
      }
      case KeySuffixOptions.Pin: {
        const userKeyEncryptedPin = await this.pinService.getUserKeyEncryptedPin(userId);
        shouldStoreKey = !!userKeyEncryptedPin;
        break;
      }
    }
    return shouldStoreKey;
  }

  protected async getKeyFromStorage(
    keySuffix: KeySuffixOptions,
    userId?: UserId,
  ): Promise<UserKey> {
    if (keySuffix === KeySuffixOptions.Auto) {
      const userKey = await this.stateService.getUserKeyAutoUnlock({ userId: userId });
      if (userKey) {
        return new SymmetricCryptoKey(Utils.fromB64ToArray(userKey)) as UserKey;
      }
    }
    return null;
  }

  protected async clearAllStoredUserKeys(userId?: UserId): Promise<void> {
    await this.stateService.setUserKeyAutoUnlock(null, { userId: userId });
    await this.pinService.clearPinKeyEncryptedUserKeyEphemeral(userId);
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

  private async buildProtectedSymmetricKey<T extends SymmetricCryptoKey>(
    encryptionKey: SymmetricCryptoKey,
    newSymKey: Uint8Array,
  ): Promise<[T, EncString]> {
    let protectedSymKey: EncString = null;
    if (encryptionKey.key.byteLength === 32) {
      const stretchedEncryptionKey = await this.keyGenerationService.stretchKey(encryptionKey);
      protectedSymKey = await this.encryptService.encrypt(newSymKey, stretchedEncryptionKey);
    } else if (encryptionKey.key.byteLength === 64) {
      protectedSymKey = await this.encryptService.encrypt(newSymKey, encryptionKey);
    } else {
      throw new Error("Invalid key size.");
    }
    return [new SymmetricCryptoKey(newSymKey) as T, protectedSymKey];
  }

  // --LEGACY METHODS--
  // We previously used the master key for additional keys, but now we use the user key.
  // These methods support migrating the old keys to the new ones.
  // TODO: Remove after 2023.10 release (https://bitwarden.atlassian.net/browse/PM-3475)

  async clearDeprecatedKeys(keySuffix: KeySuffixOptions, userId?: UserId) {
    if (keySuffix === KeySuffixOptions.Auto) {
      await this.stateService.setCryptoMasterKeyAuto(null, { userId: userId });
    } else if (keySuffix === KeySuffixOptions.Pin) {
      await this.pinService.clearOldPinKeyEncryptedMasterKey(userId);
    }
  }

  // --DEPRECATED METHODS--

  /**
   * @deprecated July 25 2022: Get the key you need from CryptoService (getKeyForUserEncryption or getOrgKey)
   * and then call encryptService.encrypt
   */
  async encrypt(plainValue: string | Uint8Array, key?: SymmetricCryptoKey): Promise<EncString> {
    key ||= await this.getUserKeyWithLegacySupport();
    return await this.encryptService.encrypt(plainValue, key);
  }

  /**
   * @deprecated July 25 2022: Get the key you need from CryptoService (getKeyForUserEncryption or getOrgKey)
   * and then call encryptService.encryptToBytes
   */
  async encryptToBytes(plainValue: Uint8Array, key?: SymmetricCryptoKey): Promise<EncArrayBuffer> {
    key ||= await this.getUserKeyWithLegacySupport();
    return this.encryptService.encryptToBytes(plainValue, key);
  }

  /**
   * @deprecated July 25 2022: Get the key you need from CryptoService (getKeyForUserEncryption or getOrgKey)
   * and then call encryptService.decryptToBytes
   */
  async decryptToBytes(encString: EncString, key?: SymmetricCryptoKey): Promise<Uint8Array> {
    key ||= await this.getUserKeyWithLegacySupport();
    return this.encryptService.decryptToBytes(encString, key);
  }

  /**
   * @deprecated July 25 2022: Get the key you need from CryptoService (getKeyForUserEncryption or getOrgKey)
   * and then call encryptService.decryptToUtf8
   */
  async decryptToUtf8(encString: EncString, key?: SymmetricCryptoKey): Promise<string> {
    key ||= await this.getUserKeyWithLegacySupport();
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

    key ||= await this.getUserKeyWithLegacySupport();

    return this.encryptService.decryptToBytes(encBuffer, key);
  }

  userKey$(userId: UserId) {
    return this.stateProvider.getUser(userId, USER_KEY).state$;
  }

  private userKeyWithLegacySupport$(userId: UserId) {
    return this.userKey$(userId).pipe(
      switchMap((userKey) => {
        if (userKey != null) {
          return of(userKey);
        }

        // Legacy path
        return this.masterPasswordService.masterKey$(userId).pipe(
          switchMap(async (masterKey) => {
            if (!(await this.validateUserKey(masterKey as unknown as UserKey, userId))) {
              // We don't have a UserKey or a valid MasterKey
              return null;
            }

            // The master key is valid meaning, the org keys and such are encrypted with this key
            return masterKey as unknown as UserKey;
          }),
        );
      }),
    );
  }

  userPublicKey$(userId: UserId) {
    return this.userPrivateKey$(userId).pipe(
      switchMap(async (pk) => await this.derivePublicKey(pk)),
    );
  }

  private async derivePublicKey(privateKey: UserPrivateKey) {
    return (await this.cryptoFunctionService.rsaExtractPublicKey(privateKey)) as UserPublicKey;
  }

  userPrivateKey$(userId: UserId): Observable<UserPrivateKey> {
    return this.userPrivateKeyHelper$(userId, false).pipe(map((keys) => keys?.userPrivateKey));
  }

  userPrivateKeyWithLegacySupport$(userId: UserId): Observable<UserPrivateKey> {
    return this.userPrivateKeyHelper$(userId, true).pipe(map((keys) => keys?.userPrivateKey));
  }

  private userPrivateKeyHelper$(userId: UserId, legacySupport: boolean) {
    const userKey$ = legacySupport ? this.userKeyWithLegacySupport$(userId) : this.userKey$(userId);
    return userKey$.pipe(
      switchMap((userKey) => {
        if (userKey == null) {
          return of(null);
        }

        return this.stateProvider.getUser(userId, USER_ENCRYPTED_PRIVATE_KEY).state$.pipe(
          switchMap(
            async (encryptedPrivateKey) =>
              await this.decryptPrivateKey(encryptedPrivateKey, userKey),
          ),
          // Combine outerscope info with user private key
          map((userPrivateKey) => ({
            userKey,
            userPrivateKey,
          })),
        );
      }),
    );
  }

  private async decryptPrivateKey(encryptedPrivateKey: EncryptedString, key: SymmetricCryptoKey) {
    if (encryptedPrivateKey == null) {
      return null;
    }

    return (await this.encryptService.decryptToBytes(
      new EncString(encryptedPrivateKey),
      key,
    )) as UserPrivateKey;
  }

  providerKeys$(userId: UserId) {
    return this.userPrivateKey$(userId).pipe(
      switchMap((userPrivateKey) => {
        if (userPrivateKey == null) {
          return of(null);
        }

        return this.providerKeysHelper$(userId, userPrivateKey);
      }),
    );
  }

  /**
   * A helper for decrypting provider keys that requires a user id and that users decrypted private key
   * this is helpful for when you may have already grabbed the user private key and don't want to redo
   * that work to get the provider keys.
   */
  private providerKeysHelper$(
    userId: UserId,
    userPrivateKey: UserPrivateKey,
  ): Observable<Record<ProviderId, ProviderKey>> {
    return this.stateProvider.getUser(userId, USER_ENCRYPTED_PROVIDER_KEYS).state$.pipe(
      // Convert each value in the record to it's own decryption observable
      convertValues(async (_, value) => {
        const decrypted = await this.encryptService.rsaDecrypt(
          new EncString(value),
          userPrivateKey,
        );
        return new SymmetricCryptoKey(decrypted) as ProviderKey;
      }),
      // switchMap since there are no side effects
      switchMap((encryptedProviderKeys) => {
        if (encryptedProviderKeys == null) {
          return of(null);
        }

        // Can't give an empty record to forkJoin
        if (Object.keys(encryptedProviderKeys).length === 0) {
          return of({});
        }

        return forkJoin(encryptedProviderKeys);
      }),
    );
  }

  orgKeys$(userId: UserId) {
    return this.cipherDecryptionKeys$(userId, true).pipe(map((keys) => keys?.orgKeys));
  }

  cipherDecryptionKeys$(
    userId: UserId,
    legacySupport: boolean = false,
  ): Observable<CipherDecryptionKeys | null> {
    return this.userPrivateKeyHelper$(userId, legacySupport).pipe(
      switchMap((userKeys) => {
        if (userKeys == null) {
          return of(null);
        }

        const userPrivateKey = userKeys.userPrivateKey;

        if (userPrivateKey == null) {
          // We can't do any org based decryption
          return of({ userKey: userKeys.userKey, orgKeys: null });
        }

        return combineLatest([
          this.stateProvider.getUser(userId, USER_ENCRYPTED_ORGANIZATION_KEYS).state$,
          this.providerKeysHelper$(userId, userPrivateKey),
        ]).pipe(
          switchMap(async ([encryptedOrgKeys, providerKeys]) => {
            const result: Record<OrganizationId, OrgKey> = {};
            for (const orgId of Object.keys(encryptedOrgKeys ?? {}) as OrganizationId[]) {
              if (result[orgId] != null) {
                continue;
              }
              const encrypted = BaseEncryptedOrganizationKey.fromData(encryptedOrgKeys[orgId]);

              let decrypted: OrgKey;

              if (BaseEncryptedOrganizationKey.isProviderEncrypted(encrypted)) {
                decrypted = await encrypted.decrypt(this.encryptService, providerKeys);
              } else {
                decrypted = await encrypted.decrypt(this.encryptService, userPrivateKey);
              }

              result[orgId] = decrypted;
            }

            return result;
          }),
          // Combine them back together
          map((orgKeys) => ({ userKey: userKeys.userKey, orgKeys: orgKeys })),
        );
      }),
    );
  }
}
