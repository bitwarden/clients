import * as bigInt from "big-integer";
import { Observable, filter, firstValueFrom, map } from "rxjs";

import { EncryptedOrganizationKeyData } from "../../admin-console/models/data/encrypted-organization-key.data";
import { ProfileOrganizationResponse } from "../../admin-console/models/response/profile-organization.response";
import { ProfileProviderOrganizationResponse } from "../../admin-console/models/response/profile-provider-organization.response";
import { ProfileProviderResponse } from "../../admin-console/models/response/profile-provider.response";
import { AccountService } from "../../auth/abstractions/account.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { KdfConfig } from "../../auth/models/domain/kdf-config";
import { Utils } from "../../platform/misc/utils";
import { CsprngArray } from "../../types/csprng";
import { OrganizationId, ProviderId, UserId } from "../../types/guid";
import {
  OrgKey,
  UserKey,
  MasterKey,
  ProviderKey,
  PinKey,
  CipherKey,
  UserPrivateKey,
  UserPublicKey,
} from "../../types/key";
import { CryptoFunctionService } from "../abstractions/crypto-function.service";
import { CryptoService as CryptoServiceAbstraction } from "../abstractions/crypto.service";
import { EncryptService } from "../abstractions/encrypt.service";
import { KeyGenerationService } from "../abstractions/key-generation.service";
import { LogService } from "../abstractions/log.service";
import { PlatformUtilsService } from "../abstractions/platform-utils.service";
import { StateService } from "../abstractions/state.service";
import {
  KeySuffixOptions,
  HashPurpose,
  KdfType,
  ARGON2_ITERATIONS,
  ARGON2_MEMORY,
  ARGON2_PARALLELISM,
  EncryptionType,
  PBKDF2_ITERATIONS,
} from "../enums";
import { sequentialize } from "../misc/sequentialize";
import { EFFLongWordList } from "../misc/wordlist";
import { EncArrayBuffer } from "../models/domain/enc-array-buffer";
import { EncString, EncryptedString } from "../models/domain/enc-string";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";
import { ActiveUserState, DerivedState, StateProvider } from "../state";

import {
  USER_ENCRYPTED_ORGANIZATION_KEYS,
  USER_ORGANIZATION_KEYS,
} from "./key-state/org-keys.state";
import { USER_ENCRYPTED_PROVIDER_KEYS, USER_PROVIDER_KEYS } from "./key-state/provider-keys.state";
import {
  USER_ENCRYPTED_PRIVATE_KEY,
  USER_EVER_HAD_USER_KEY,
  USER_PRIVATE_KEY,
  USER_PUBLIC_KEY,
  USER_KEY,
} from "./key-state/user-key.state";

export class CryptoService implements CryptoServiceAbstraction {
  private readonly activeUserKeyState: ActiveUserState<UserKey>;
  private readonly activeUserEverHadUserKey: ActiveUserState<boolean>;
  private readonly activeUserEncryptedOrgKeysState: ActiveUserState<
    Record<OrganizationId, EncryptedOrganizationKeyData>
  >;
  private readonly activeUserOrgKeysState: DerivedState<Record<OrganizationId, OrgKey>>;
  private readonly activeUserEncryptedProviderKeysState: ActiveUserState<
    Record<ProviderId, EncryptedString>
  >;
  private readonly activeUserProviderKeysState: DerivedState<Record<ProviderId, ProviderKey>>;
  private readonly activeUserEncryptedPrivateKeyState: ActiveUserState<EncryptedString>;
  private readonly activeUserPrivateKeyState: DerivedState<UserPrivateKey>;
  private readonly activeUserPublicKeyState: DerivedState<UserPublicKey>;

  readonly activeUserKey$: Observable<UserKey>;

  readonly activeUserOrgKeys$: Observable<Record<OrganizationId, OrgKey>>;
  readonly activeUserProviderKeys$: Observable<Record<ProviderId, ProviderKey>>;
  readonly activeUserPrivateKey$: Observable<UserPrivateKey>;
  readonly activeUserPublicKey$: Observable<UserPublicKey>;
  readonly everHadUserKey$: Observable<boolean>;

  constructor(
    protected keyGenerationService: KeyGenerationService,
    protected cryptoFunctionService: CryptoFunctionService,
    protected encryptService: EncryptService,
    protected platformUtilService: PlatformUtilsService,
    protected logService: LogService,
    protected stateService: StateService,
    protected accountService: AccountService,
    protected stateProvider: StateProvider,
  ) {
    // User Key
    this.activeUserKeyState = stateProvider.getActive(USER_KEY);
    this.activeUserKey$ = this.activeUserKeyState.state$;
    this.activeUserEverHadUserKey = stateProvider.getActive(USER_EVER_HAD_USER_KEY);
    this.everHadUserKey$ = this.activeUserEverHadUserKey.state$.pipe(map((x) => x ?? false));

    // User Asymmetric Key Pair
    this.activeUserEncryptedPrivateKeyState = stateProvider.getActive(USER_ENCRYPTED_PRIVATE_KEY);
    this.activeUserPrivateKeyState = stateProvider.getDerived(
      this.activeUserEncryptedPrivateKeyState.combinedState$.pipe(
        filter(([_userId, key]) => key != null),
      ),
      USER_PRIVATE_KEY,
      {
        encryptService: this.encryptService,
        cryptoService: this,
      },
    );
    this.activeUserPrivateKey$ = this.activeUserPrivateKeyState.state$; // may be null
    this.activeUserPublicKeyState = stateProvider.getDerived(
      this.activeUserPrivateKey$.pipe(filter((key) => key != null)),
      USER_PUBLIC_KEY,
      {
        cryptoFunctionService: this.cryptoFunctionService,
      },
    );
    this.activeUserPublicKey$ = this.activeUserPublicKeyState.state$; // may be null

    // Organization keys
    this.activeUserEncryptedOrgKeysState = stateProvider.getActive(
      USER_ENCRYPTED_ORGANIZATION_KEYS,
    );
    this.activeUserOrgKeysState = stateProvider.getDerived(
      this.activeUserEncryptedOrgKeysState.state$.pipe(filter((keys) => keys != null)),
      USER_ORGANIZATION_KEYS,
      { cryptoService: this },
    );
    this.activeUserOrgKeys$ = this.activeUserOrgKeysState.state$; // null handled by `derive` function

    // Provider keys
    this.activeUserEncryptedProviderKeysState = stateProvider.getActive(
      USER_ENCRYPTED_PROVIDER_KEYS,
    );
    this.activeUserProviderKeysState = stateProvider.getDerived(
      this.activeUserEncryptedProviderKeysState.state$.pipe(filter((keys) => keys != null)),
      USER_PROVIDER_KEYS,
      { encryptService: this.encryptService, cryptoService: this },
    );
    this.activeUserProviderKeys$ = this.activeUserProviderKeysState.state$; // null handled by `derive` function
  }

  async setUserKey(key: UserKey, userId?: UserId): Promise<void> {
    if (key == null) {
      throw new Error("No key provided. Use ClearUserKey to clear the key");
    }
    // Set userId to ensure we have one for the account status update
    [userId, key] = await this.stateProvider.setUserState(USER_KEY, key, userId);
    await this.stateProvider.setUserState(USER_EVER_HAD_USER_KEY, true, userId);

    await this.accountService.setAccountStatus(userId, AuthenticationStatus.Unlocked);

    await this.storeAdditionalKeys(key, userId);
  }

  async refreshAdditionalKeys(): Promise<void> {
    const key = await this.getUserKey();
    await this.setUserKey(key);
  }

  async getUserKey(userId?: UserId): Promise<UserKey> {
    let userKey = await firstValueFrom(this.stateProvider.getUserState$(USER_KEY, userId));
    if (userKey) {
      return userKey;
    }

    // If the user has set their vault timeout to 'Never', we can load the user key from storage
    if (await this.hasUserKeyStored(KeySuffixOptions.Auto, userId)) {
      userKey = await this.getKeyFromStorage(KeySuffixOptions.Auto, userId);
      if (userKey) {
        await this.setUserKey(userKey, userId);
        return userKey;
      }
    }
  }

  async isLegacyUser(masterKey?: MasterKey, userId?: UserId): Promise<boolean> {
    return await this.validateUserKey(
      (masterKey ?? (await this.getMasterKey(userId))) as unknown as UserKey,
    );
  }

  async getUserKeyWithLegacySupport(userId?: UserId): Promise<UserKey> {
    const userKey = await this.getUserKey(userId);
    if (userKey) {
      return userKey;
    }

    // Legacy support: encryption used to be done with the master key (derived from master password).
    // Users who have not migrated will have a null user key and must use the master key instead.
    return (await this.getMasterKey(userId)) as unknown as UserKey;
  }

  async getUserKeyFromStorage(keySuffix: KeySuffixOptions, userId?: UserId): Promise<UserKey> {
    const userKey = await this.getKeyFromStorage(keySuffix, userId);
    if (userKey) {
      if (!(await this.validateUserKey(userKey))) {
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
    return (
      (await this.hasUserKeyInMemory(userId)) ||
      (await this.hasUserKeyStored(KeySuffixOptions.Auto, userId))
    );
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
    masterKey ||= await this.getMasterKey();
    if (masterKey == null) {
      throw new Error("No Master Key found.");
    }

    const newUserKey = await this.keyGenerationService.createKey(512);
    return this.buildProtectedSymmetricKey(masterKey, newUserKey.key);
  }

  async clearUserKey(clearStoredKeys = true, userId?: UserId): Promise<void> {
    // Set userId to ensure we have one for the account status update
    [userId] = await this.stateProvider.setUserState(USER_KEY, null, userId);
    await this.accountService.setMaxAccountStatus(userId, AuthenticationStatus.Locked);
    if (clearStoredKeys) {
      await this.clearAllStoredUserKeys(userId);
    }
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
      this.stateService.setPinKeyEncryptedUserKeyEphemeral(null, { userId: userId });
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.clearDeprecatedKeys(KeySuffixOptions.Pin, userId);
    }
  }

  async setMasterKeyEncryptedUserKey(userKeyMasterKey: string, userId?: UserId): Promise<void> {
    await this.stateService.setMasterKeyEncryptedUserKey(userKeyMasterKey, { userId: userId });
  }

  async setMasterKey(key: MasterKey, userId?: UserId): Promise<void> {
    await this.stateService.setMasterKey(key, { userId: userId });
  }

  async getMasterKey(userId?: UserId): Promise<MasterKey> {
    let masterKey = await this.stateService.getMasterKey({ userId: userId });
    if (!masterKey) {
      masterKey = (await this.stateService.getCryptoMasterKey({ userId: userId })) as MasterKey;
      // if master key was null/undefined and getCryptoMasterKey also returned null/undefined,
      // don't set master key as it is unnecessary
      if (masterKey) {
        await this.setMasterKey(masterKey, userId);
      }
    }
    return masterKey;
  }

  async getOrDeriveMasterKey(password: string, userId?: UserId) {
    let masterKey = await this.getMasterKey(userId);
    return (masterKey ||= await this.makeMasterKey(
      password,
      await this.stateService.getEmail({ userId: userId }),
      await this.stateService.getKdfType({ userId: userId }),
      await this.stateService.getKdfConfig({ userId: userId }),
    ));
  }

  /**
   * Derive a master key from a password and email.
   *
   * @remarks
   * Does not validate the kdf config to ensure it satisfies the minimum requirements for the given kdf type.
   */
  async makeMasterKey(
    password: string,
    email: string,
    kdf: KdfType,
    KdfConfig: KdfConfig,
  ): Promise<MasterKey> {
    return (await this.keyGenerationService.deriveKeyFromPassword(
      password,
      email,
      kdf,
      KdfConfig,
    )) as MasterKey;
  }

  async clearMasterKey(userId?: UserId): Promise<void> {
    await this.stateService.setMasterKey(null, { userId: userId });
  }

  async encryptUserKeyWithMasterKey(
    masterKey: MasterKey,
    userKey?: UserKey,
  ): Promise<[UserKey, EncString]> {
    userKey ||= await this.getUserKey();
    return await this.buildProtectedSymmetricKey(masterKey, userKey.key);
  }

  async decryptUserKeyWithMasterKey(
    masterKey: MasterKey,
    userKey?: EncString,
    userId?: UserId,
  ): Promise<UserKey> {
    masterKey ||= await this.getMasterKey(userId);
    if (masterKey == null) {
      throw new Error("No master key found.");
    }

    if (!userKey) {
      let masterKeyEncryptedUserKey = await this.stateService.getMasterKeyEncryptedUserKey({
        userId: userId,
      });

      // Try one more way to get the user key if it still wasn't found.
      if (masterKeyEncryptedUserKey == null) {
        masterKeyEncryptedUserKey = await this.stateService.getEncryptedCryptoSymmetricKey({
          userId: userId,
        });
      }

      if (masterKeyEncryptedUserKey == null) {
        throw new Error("No encrypted user key found.");
      }
      userKey = new EncString(masterKeyEncryptedUserKey);
    }

    let decUserKey: Uint8Array;
    if (userKey.encryptionType === EncryptionType.AesCbc256_B64) {
      decUserKey = await this.encryptService.decryptToBytes(userKey, masterKey);
    } else if (userKey.encryptionType === EncryptionType.AesCbc256_HmacSha256_B64) {
      const newKey = await this.stretchKey(masterKey);
      decUserKey = await this.encryptService.decryptToBytes(userKey, newKey);
    } else {
      throw new Error("Unsupported encryption type.");
    }
    if (decUserKey == null) {
      return null;
    }

    return new SymmetricCryptoKey(decUserKey) as UserKey;
  }

  async hashMasterKey(
    password: string,
    key: MasterKey,
    hashPurpose?: HashPurpose,
  ): Promise<string> {
    key ||= await this.getMasterKey();

    if (password == null || key == null) {
      throw new Error("Invalid parameters.");
    }

    const iterations = hashPurpose === HashPurpose.LocalAuthorization ? 2 : 1;
    const hash = await this.cryptoFunctionService.pbkdf2(key.key, password, "sha256", iterations);
    return Utils.fromBufferToB64(hash);
  }

  async setMasterKeyHash(keyHash: string): Promise<void> {
    await this.stateService.setKeyHash(keyHash);
  }

  async getMasterKeyHash(): Promise<string> {
    return await this.stateService.getKeyHash();
  }

  async clearMasterKeyHash(userId?: UserId): Promise<void> {
    return await this.stateService.setKeyHash(null, { userId: userId });
  }

  async compareAndUpdateKeyHash(masterPassword: string, masterKey: MasterKey): Promise<boolean> {
    const storedPasswordHash = await this.getMasterKeyHash();
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
        await this.setMasterKeyHash(localKeyHash);
        return true;
      }
    }

    return false;
  }

  async setOrgKeys(
    orgs: ProfileOrganizationResponse[] = [],
    providerOrgs: ProfileProviderOrganizationResponse[] = [],
  ): Promise<void> {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.activeUserEncryptedOrgKeysState.update((_) => {
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
    return (await firstValueFrom(this.activeUserOrgKeys$))[orgId];
  }

  @sequentialize(() => "getOrgKeys")
  async getOrgKeys(): Promise<Record<string, OrgKey>> {
    return await firstValueFrom(this.activeUserOrgKeys$);
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

  async clearOrgKeys(memoryOnly?: boolean, userId?: UserId): Promise<void> {
    const activeUserId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    const userIdIsActive = userId == null || userId === activeUserId;

    if (!memoryOnly) {
      if (userId == null && activeUserId == null) {
        // nothing to do
        return;
      }
      await this.stateProvider
        .getUser(userId ?? activeUserId, USER_ENCRYPTED_ORGANIZATION_KEYS)
        .update(() => null);
      return;
    }

    // org keys are only cached for active users
    if (userIdIsActive) {
      await this.activeUserOrgKeysState.forceValue({});
    }
  }

  async setProviderKeys(providers: ProfileProviderResponse[]): Promise<void> {
    await this.activeUserEncryptedProviderKeysState.update((_) => {
      const encProviderKeys: { [providerId: ProviderId]: EncryptedString } = {};

      providers.forEach((provider) => {
        encProviderKeys[provider.id as ProviderId] = provider.key as EncryptedString;
      });

      return encProviderKeys;
    });
  }

  async getProviderKey(providerId: ProviderId): Promise<ProviderKey> {
    if (providerId == null) {
      return null;
    }

    return (await firstValueFrom(this.activeUserProviderKeys$))[providerId] ?? null;
  }

  @sequentialize(() => "getProviderKeys")
  async getProviderKeys(): Promise<Record<ProviderId, ProviderKey>> {
    return await firstValueFrom(this.activeUserProviderKeys$);
  }

  async clearProviderKeys(memoryOnly?: boolean, userId?: UserId): Promise<void> {
    const activeUserId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    const userIdIsActive = userId == null || userId === activeUserId;

    if (!memoryOnly) {
      if (userId == null && activeUserId == null) {
        // nothing to do
        return;
      }
      await this.stateProvider
        .getUser(userId ?? activeUserId, USER_ENCRYPTED_PROVIDER_KEYS)
        .update(() => null);
      return;
    }

    // provider keys are only cached for active users
    if (userIdIsActive) {
      await this.activeUserProviderKeysState.forceValue({});
    }
  }

  async getPublicKey(): Promise<Uint8Array> {
    return await firstValueFrom(this.activeUserPublicKey$);
  }

  async makeOrgKey<T extends OrgKey | ProviderKey>(): Promise<[EncString, T]> {
    const shareKey = await this.keyGenerationService.createKey(512);
    const publicKey = await this.getPublicKey();
    const encShareKey = await this.rsaEncrypt(shareKey.key, publicKey);
    return [encShareKey, shareKey as T];
  }

  async setPrivateKey(encPrivateKey: EncryptedString): Promise<void> {
    if (encPrivateKey == null) {
      return;
    }

    await this.activeUserEncryptedPrivateKeyState.update(() => encPrivateKey);
  }

  async getPrivateKey(): Promise<Uint8Array> {
    return await firstValueFrom(this.activeUserPrivateKey$);
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
      "sha256",
    );
    return this.hashPhrase(userFingerprint);
  }

  async makeKeyPair(key?: SymmetricCryptoKey): Promise<[string, EncString]> {
    // Default to user key
    key ||= await this.getUserKeyWithLegacySupport();

    const keyPair = await this.cryptoFunctionService.rsaGenerateKeyPair(2048);
    const publicB64 = Utils.fromBufferToB64(keyPair[0]);
    const privateEnc = await this.encryptService.encrypt(keyPair[1], key);
    return [publicB64, privateEnc];
  }

  async clearKeyPair(memoryOnly?: boolean, userId?: UserId): Promise<void[]> {
    const activeUserId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    const userIdIsActive = userId == null || userId === activeUserId;

    if (!memoryOnly) {
      if (userId == null && activeUserId == null) {
        // nothing to do
        return;
      }
      await this.stateProvider
        .getUser(userId ?? activeUserId, USER_ENCRYPTED_PRIVATE_KEY)
        .update(() => null);
      return;
    }

    // decrypted key pair is only cached for active users
    if (userIdIsActive) {
      await this.activeUserPrivateKeyState.forceValue(null);
      await this.activeUserPublicKeyState.forceValue(null);
    }
  }

  async makePinKey(pin: string, salt: string, kdf: KdfType, kdfConfig: KdfConfig): Promise<PinKey> {
    const pinKey = await this.keyGenerationService.deriveKeyFromPassword(pin, salt, kdf, kdfConfig);
    return (await this.stretchKey(pinKey)) as PinKey;
  }

  async clearPinKeys(userId?: UserId): Promise<void> {
    await this.stateService.setPinKeyEncryptedUserKey(null, { userId: userId });
    await this.stateService.setPinKeyEncryptedUserKeyEphemeral(null, { userId: userId });
    await this.stateService.setProtectedPin(null, { userId: userId });
    await this.clearDeprecatedKeys(KeySuffixOptions.Pin, userId);
  }

  async decryptUserKeyWithPin(
    pin: string,
    salt: string,
    kdf: KdfType,
    kdfConfig: KdfConfig,
    pinProtectedUserKey?: EncString,
  ): Promise<UserKey> {
    pinProtectedUserKey ||= await this.stateService.getPinKeyEncryptedUserKey();
    pinProtectedUserKey ||= await this.stateService.getPinKeyEncryptedUserKeyEphemeral();
    if (!pinProtectedUserKey) {
      throw new Error("No PIN protected key found.");
    }
    const pinKey = await this.makePinKey(pin, salt, kdf, kdfConfig);
    const userKey = await this.encryptService.decryptToBytes(pinProtectedUserKey, pinKey);
    return new SymmetricCryptoKey(userKey) as UserKey;
  }

  // only for migration purposes
  async decryptMasterKeyWithPin(
    pin: string,
    salt: string,
    kdf: KdfType,
    kdfConfig: KdfConfig,
    pinProtectedMasterKey?: EncString,
  ): Promise<MasterKey> {
    if (!pinProtectedMasterKey) {
      const pinProtectedMasterKeyString = await this.stateService.getEncryptedPinProtected();
      if (pinProtectedMasterKeyString == null) {
        throw new Error("No PIN protected key found.");
      }
      pinProtectedMasterKey = new EncString(pinProtectedMasterKeyString);
    }
    const pinKey = await this.makePinKey(pin, salt, kdf, kdfConfig);
    const masterKey = await this.encryptService.decryptToBytes(pinProtectedMasterKey, pinKey);
    return new SymmetricCryptoKey(masterKey) as MasterKey;
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
    await this.clearUserKey(true, userId);
    await this.clearMasterKeyHash(userId);
    await this.clearOrgKeys(false, userId);
    await this.clearProviderKeys(false, userId);
    await this.clearKeyPair(false, userId);
    await this.clearPinKeys(userId);
    await this.stateProvider.setUserState(USER_EVER_HAD_USER_KEY, null, userId);
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
  protected async validateUserKey(key: UserKey): Promise<boolean> {
    if (!key) {
      return false;
    }

    try {
      const [userId, encPrivateKey] = await firstValueFrom(
        this.activeUserEncryptedPrivateKeyState.combinedState$,
      );
      if (encPrivateKey == null) {
        return false;
      }

      // Can decrypt private key
      const privateKey = await USER_PRIVATE_KEY.derive([userId, encPrivateKey], {
        encryptService: this.encryptService,
        cryptoService: this,
      });

      // Can successfully derive public key
      await USER_PUBLIC_KEY.derive(privateKey, {
        cryptoFunctionService: this.cryptoFunctionService,
      });
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
    const userKey = (await this.keyGenerationService.createKey(512)) as UserKey;
    const [publicKey, privateKey] = await this.makeKeyPair(userKey);
    await this.setUserKey(userKey);
    await this.activeUserEncryptedPrivateKeyState.update(() => privateKey.encryptedString);

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
    const storeAuto = await this.shouldStoreKey(KeySuffixOptions.Auto, userId);
    if (storeAuto) {
      await this.stateService.setUserKeyAutoUnlock(key.keyB64, { userId: userId });
    } else {
      await this.stateService.setUserKeyAutoUnlock(null, { userId: userId });
    }
    await this.clearDeprecatedKeys(KeySuffixOptions.Auto, userId);

    const storePin = await this.shouldStoreKey(KeySuffixOptions.Pin, userId);
    if (storePin) {
      await this.storePinKey(key, userId);
      // We can't always clear deprecated keys because the pin is only
      // migrated once used to unlock
      await this.clearDeprecatedKeys(KeySuffixOptions.Pin, userId);
    } else {
      await this.stateService.setPinKeyEncryptedUserKey(null, { userId: userId });
      await this.stateService.setPinKeyEncryptedUserKeyEphemeral(null, { userId: userId });
    }
  }

  /**
   * Stores the pin key if needed. If MP on Reset is enabled, stores the
   * ephemeral version.
   * @param key The user key
   */
  protected async storePinKey(key: UserKey, userId?: UserId) {
    const pin = await this.encryptService.decryptToUtf8(
      new EncString(await this.stateService.getProtectedPin({ userId: userId })),
      key,
    );
    const pinKey = await this.makePinKey(
      pin,
      await this.stateService.getEmail({ userId: userId }),
      await this.stateService.getKdfType({ userId: userId }),
      await this.stateService.getKdfConfig({ userId: userId }),
    );
    const encPin = await this.encryptService.encrypt(key.key, pinKey);

    if ((await this.stateService.getPinKeyEncryptedUserKey({ userId: userId })) != null) {
      await this.stateService.setPinKeyEncryptedUserKey(encPin, { userId: userId });
    } else {
      await this.stateService.setPinKeyEncryptedUserKeyEphemeral(encPin, { userId: userId });
    }
  }

  protected async shouldStoreKey(keySuffix: KeySuffixOptions, userId?: UserId) {
    let shouldStoreKey = false;
    switch (keySuffix) {
      case KeySuffixOptions.Auto: {
        const vaultTimeout = await this.stateService.getVaultTimeout({ userId: userId });
        shouldStoreKey = vaultTimeout == null;
        break;
      }
      case KeySuffixOptions.Pin: {
        const protectedPin = await this.stateService.getProtectedPin({ userId: userId });
        shouldStoreKey = !!protectedPin;
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

  /**
   * Validate that the KDF config follows the requirements for the given KDF type.
   *
   * @remarks
   * Should always be called before updating a users KDF config.
   */
  validateKdfConfig(kdf: KdfType, kdfConfig: KdfConfig): void {
    switch (kdf) {
      case KdfType.PBKDF2_SHA256:
        if (!PBKDF2_ITERATIONS.inRange(kdfConfig.iterations)) {
          throw new Error(
            `PBKDF2 iterations must be between ${PBKDF2_ITERATIONS.min} and ${PBKDF2_ITERATIONS.max}`,
          );
        }
        break;
      case KdfType.Argon2id:
        if (!ARGON2_ITERATIONS.inRange(kdfConfig.iterations)) {
          throw new Error(
            `Argon2 iterations must be between ${ARGON2_ITERATIONS.min} and ${ARGON2_ITERATIONS.max}`,
          );
        }

        if (!ARGON2_MEMORY.inRange(kdfConfig.memory)) {
          throw new Error(
            `Argon2 memory must be between ${ARGON2_MEMORY.min}mb and ${ARGON2_MEMORY.max}mb`,
          );
        }

        if (!ARGON2_PARALLELISM.inRange(kdfConfig.parallelism)) {
          throw new Error(
            `Argon2 parallelism must be between ${ARGON2_PARALLELISM.min} and ${ARGON2_PARALLELISM.max}.`,
          );
        }
        break;
    }
  }

  protected async clearAllStoredUserKeys(userId?: UserId): Promise<void> {
    await this.stateService.setUserKeyAutoUnlock(null, { userId: userId });
    await this.stateService.setPinKeyEncryptedUserKeyEphemeral(null, { userId: userId });
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

  private async buildProtectedSymmetricKey<T extends SymmetricCryptoKey>(
    encryptionKey: SymmetricCryptoKey,
    newSymKey: Uint8Array,
  ): Promise<[T, EncString]> {
    let protectedSymKey: EncString = null;
    if (encryptionKey.key.byteLength === 32) {
      const stretchedEncryptionKey = await this.stretchKey(encryptionKey);
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
      await this.stateService.setEncryptedPinProtected(null, { userId: userId });
      await this.stateService.setDecryptedPinProtected(null, { userId: userId });
    }
  }

  async migrateAutoKeyIfNeeded(userId?: UserId) {
    const oldAutoKey = await this.stateService.getCryptoMasterKeyAuto({ userId: userId });
    if (!oldAutoKey) {
      return;
    }
    // Decrypt
    const masterKey = new SymmetricCryptoKey(Utils.fromB64ToArray(oldAutoKey)) as MasterKey;
    if (await this.isLegacyUser(masterKey, userId)) {
      // Legacy users don't have a user key, so no need to migrate.
      // Instead, set the master key for additional isLegacyUser checks that will log the user out.
      await this.setMasterKey(masterKey, userId);
      return;
    }
    const encryptedUserKey = await this.stateService.getEncryptedCryptoSymmetricKey({
      userId: userId,
    });
    const userKey = await this.decryptUserKeyWithMasterKey(
      masterKey,
      new EncString(encryptedUserKey),
      userId,
    );
    // Migrate
    await this.stateService.setUserKeyAutoUnlock(userKey.keyB64, { userId: userId });
    await this.stateService.setCryptoMasterKeyAuto(null, { userId: userId });
    // Set encrypted user key in case user immediately locks without syncing
    await this.setMasterKeyEncryptedUserKey(encryptedUserKey);
  }

  async decryptAndMigrateOldPinKey(
    masterPasswordOnRestart: boolean,
    pin: string,
    email: string,
    kdf: KdfType,
    kdfConfig: KdfConfig,
    oldPinKey: EncString,
  ): Promise<UserKey> {
    // Decrypt
    const masterKey = await this.decryptMasterKeyWithPin(pin, email, kdf, kdfConfig, oldPinKey);
    const encUserKey = await this.stateService.getEncryptedCryptoSymmetricKey();
    const userKey = await this.decryptUserKeyWithMasterKey(masterKey, new EncString(encUserKey));
    // Migrate
    const pinKey = await this.makePinKey(pin, email, kdf, kdfConfig);
    const pinProtectedKey = await this.encryptService.encrypt(userKey.key, pinKey);
    if (masterPasswordOnRestart) {
      await this.stateService.setDecryptedPinProtected(null);
      await this.stateService.setPinKeyEncryptedUserKeyEphemeral(pinProtectedKey);
    } else {
      await this.stateService.setEncryptedPinProtected(null);
      await this.stateService.setPinKeyEncryptedUserKey(pinProtectedKey);
      // We previously only set the protected pin if MP on Restart was enabled
      // now we set it regardless
      const encPin = await this.encryptService.encrypt(pin, userKey);
      await this.stateService.setProtectedPin(encPin.encryptedString);
    }
    // This also clears the old Biometrics key since the new Biometrics key will
    // be created when the user key is set.
    await this.stateService.setCryptoMasterKeyBiometric(null);
    return userKey;
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
}
