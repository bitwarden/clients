import { mock } from "jest-mock-extended";
import { bufferCount, firstValueFrom, lastValueFrom, of, take, tap } from "rxjs";

import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { EncryptedOrganizationKeyData } from "@bitwarden/common/admin-console/models/data/encrypted-organization-key.data";
import { FakeMasterPasswordService } from "@bitwarden/common/auth/services/master-password/fake-master-password.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { VaultTimeoutStringType } from "@bitwarden/common/key-management/vault-timeout";
import { VAULT_TIMEOUT } from "@bitwarden/common/key-management/vault-timeout/services/vault-timeout-settings.state";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Encrypted } from "@bitwarden/common/platform/interfaces/encrypted";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString, EncryptedString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { USER_ENCRYPTED_ORGANIZATION_KEYS } from "@bitwarden/common/platform/services/key-state/org-keys.state";
import { USER_ENCRYPTED_PROVIDER_KEYS } from "@bitwarden/common/platform/services/key-state/provider-keys.state";
import {
  USER_ENCRYPTED_PRIVATE_KEY,
  USER_EVER_HAD_USER_KEY,
  USER_KEY,
} from "@bitwarden/common/platform/services/key-state/user-key.state";
import { UserKeyDefinition } from "@bitwarden/common/platform/state";
import {
  awaitAsync,
  makeEncString,
  makeStaticByteArray,
  makeSymmetricCryptoKey,
  FakeAccountService,
  mockAccountServiceWith,
  FakeStateProvider,
  FakeActiveUserState,
  FakeSingleUserState,
} from "@bitwarden/common/spec";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { UserKey, MasterKey } from "@bitwarden/common/types/key";

import { KdfConfigService } from "./abstractions/kdf-config.service";
import { UserPrivateKeyDecryptionFailedError } from "./abstractions/key.service";
import { DefaultKeyService } from "./key.service";

describe("keyService", () => {
  let keyService: DefaultKeyService;

  const pinService = mock<PinServiceAbstraction>();
  const keyGenerationService = mock<KeyGenerationService>();
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const encryptService = mock<EncryptService>();
  const platformUtilService = mock<PlatformUtilsService>();
  const logService = mock<LogService>();
  const stateService = mock<StateService>();
  const kdfConfigService = mock<KdfConfigService>();
  let stateProvider: FakeStateProvider;

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    masterPasswordService = new FakeMasterPasswordService();
    stateProvider = new FakeStateProvider(accountService);

    keyService = new DefaultKeyService(
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
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("instantiates", () => {
    expect(keyService).not.toBeFalsy();
  });

  describe("getUserKey", () => {
    let mockUserKey: UserKey;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
    });

    it("retrieves the key state of the requested user", async () => {
      await keyService.getUserKey(mockUserId);

      expect(stateProvider.mock.getUserState$).toHaveBeenCalledWith(USER_KEY, mockUserId);
    });

    it("returns the User Key if available", async () => {
      stateProvider.singleUser.getFake(mockUserId, USER_KEY).nextState(mockUserKey);

      const userKey = await keyService.getUserKey(mockUserId);

      expect(userKey).toEqual(mockUserKey);
    });

    it("returns nullish if the user key is not set", async () => {
      const userKey = await keyService.getUserKey(mockUserId);

      expect(userKey).toBeFalsy();
    });
  });

  describe.each(["hasUserKey", "hasUserKeyInMemory"])(`%s`, (methodName: string) => {
    let mockUserKey: UserKey;
    let method: (userId?: UserId) => Promise<boolean>;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
      method =
        methodName === "hasUserKey"
          ? keyService.hasUserKey.bind(keyService)
          : keyService.hasUserKeyInMemory.bind(keyService);
    });

    it.each([true, false])("returns %s if the user key is set", async (hasKey) => {
      stateProvider.singleUser.getFake(mockUserId, USER_KEY).nextState(hasKey ? mockUserKey : null);
      expect(await method(mockUserId)).toBe(hasKey);
    });

    it("returns false when no active userId is set", async () => {
      accountService.activeAccountSubject.next(null);
      expect(await method()).toBe(false);
    });

    it.each([true, false])(
      "resolves %s for active user id when none is provided",
      async (hasKey) => {
        stateProvider.activeUserId$ = of(mockUserId);
        stateProvider.singleUser
          .getFake(mockUserId, USER_KEY)
          .nextState(hasKey ? mockUserKey : null);
        expect(await method()).toBe(hasKey);
      },
    );
  });

  describe("getUserKeyWithLegacySupport", () => {
    let mockUserKey: UserKey;
    let mockMasterKey: MasterKey;
    let getMasterKey: jest.SpyInstance;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
      mockMasterKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as MasterKey;

      getMasterKey = jest.spyOn(masterPasswordService, "masterKey$");
    });

    it("returns the User Key if available", async () => {
      stateProvider.singleUser.getFake(mockUserId, USER_KEY).nextState(mockUserKey);
      const getKeySpy = jest.spyOn(keyService, "getUserKey");

      const userKey = await keyService.getUserKeyWithLegacySupport(mockUserId);

      expect(getKeySpy).toHaveBeenCalledWith(mockUserId);
      expect(getMasterKey).not.toHaveBeenCalled();

      expect(userKey).toEqual(mockUserKey);
    });

    it("returns the user's master key when User Key is not available", async () => {
      masterPasswordService.masterKeySubject.next(mockMasterKey);

      const userKey = await keyService.getUserKeyWithLegacySupport(mockUserId);

      expect(getMasterKey).toHaveBeenCalledWith(mockUserId);
      expect(userKey).toEqual(mockMasterKey);
    });
  });

  describe("everHadUserKey$", () => {
    let everHadUserKeyState: FakeActiveUserState<boolean>;

    beforeEach(() => {
      everHadUserKeyState = stateProvider.activeUser.getFake(USER_EVER_HAD_USER_KEY);
    });

    it("should return true when stored value is true", async () => {
      everHadUserKeyState.nextState(true);

      expect(await firstValueFrom(keyService.everHadUserKey$)).toBe(true);
    });

    it("should return false when stored value is false", async () => {
      everHadUserKeyState.nextState(false);

      expect(await firstValueFrom(keyService.everHadUserKey$)).toBe(false);
    });

    it("should return false when stored value is null", async () => {
      everHadUserKeyState.nextState(null);

      expect(await firstValueFrom(keyService.everHadUserKey$)).toBe(false);
    });
  });

  describe("setUserKey", () => {
    let mockUserKey: UserKey;
    let everHadUserKeyState: FakeSingleUserState<boolean>;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
      everHadUserKeyState = stateProvider.singleUser.getFake(mockUserId, USER_EVER_HAD_USER_KEY);

      // Initialize storage
      everHadUserKeyState.nextState(null);
    });

    it("should set everHadUserKey if key is not null to true", async () => {
      await keyService.setUserKey(mockUserKey, mockUserId);

      expect(await firstValueFrom(everHadUserKeyState.state$)).toBe(true);
    });

    describe("Auto Key refresh", () => {
      it("sets an Auto key if vault timeout is set to 'never'", async () => {
        await stateProvider.setUserState(VAULT_TIMEOUT, VaultTimeoutStringType.Never, mockUserId);

        await keyService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(mockUserKey.keyB64, {
          userId: mockUserId,
        });
      });

      it("clears the Auto key if vault timeout is set to anything other than null", async () => {
        await stateProvider.setUserState(VAULT_TIMEOUT, 10, mockUserId);

        await keyService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      });

      it("clears the old deprecated Auto key whenever a User Key is set", async () => {
        await keyService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setCryptoMasterKeyAuto).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      });
    });

    it("throws if key is null", async () => {
      await expect(keyService.setUserKey(null as unknown as UserKey, mockUserId)).rejects.toThrow(
        "No key provided.",
      );
    });

    it("throws if userId is null", async () => {
      await expect(keyService.setUserKey(mockUserKey, null as unknown as UserId)).rejects.toThrow(
        "No userId provided.",
      );
    });

    describe("Pin Key refresh", () => {
      const mockPinKeyEncryptedUserKey = new EncString(
        "2.AAAw2vTUePO+CCyokcIfVw==|DTBNlJ5yVsV2Bsk3UU3H6Q==|YvFBff5gxWqM+UsFB6BKimKxhC32AtjF3IStpU1Ijwg=",
      );
      const mockUserKeyEncryptedPin = new EncString(
        "2.BBBw2vTUePO+CCyokcIfVw==|DTBNlJ5yVsV2Bsk3UU3H6Q==|YvFBff5gxWqM+UsFB6BKimKxhC32AtjF3IStpU1Ijwg=",
      );

      it("sets a pinKeyEncryptedUserKeyPersistent if a userKeyEncryptedPin and pinKeyEncryptedUserKey is set", async () => {
        pinService.createPinKeyEncryptedUserKey.mockResolvedValue(mockPinKeyEncryptedUserKey);
        pinService.getUserKeyEncryptedPin.mockResolvedValue(mockUserKeyEncryptedPin);
        pinService.getPinKeyEncryptedUserKeyPersistent.mockResolvedValue(
          mockPinKeyEncryptedUserKey,
        );

        await keyService.setUserKey(mockUserKey, mockUserId);

        expect(pinService.storePinKeyEncryptedUserKey).toHaveBeenCalledWith(
          mockPinKeyEncryptedUserKey,
          false,
          mockUserId,
        );
      });

      it("sets a pinKeyEncryptedUserKeyEphemeral if a userKeyEncryptedPin is set, but a pinKeyEncryptedUserKey is not set", async () => {
        pinService.createPinKeyEncryptedUserKey.mockResolvedValue(mockPinKeyEncryptedUserKey);
        pinService.getUserKeyEncryptedPin.mockResolvedValue(mockUserKeyEncryptedPin);
        pinService.getPinKeyEncryptedUserKeyPersistent.mockResolvedValue(null);

        await keyService.setUserKey(mockUserKey, mockUserId);

        expect(pinService.storePinKeyEncryptedUserKey).toHaveBeenCalledWith(
          mockPinKeyEncryptedUserKey,
          true,
          mockUserId,
        );
      });

      it("clears the pinKeyEncryptedUserKeyPersistent and pinKeyEncryptedUserKeyEphemeral if the UserKeyEncryptedPin is not set", async () => {
        pinService.getUserKeyEncryptedPin.mockResolvedValue(null);

        await keyService.setUserKey(mockUserKey, mockUserId);

        expect(pinService.clearPinKeyEncryptedUserKeyPersistent).toHaveBeenCalledWith(mockUserId);
        expect(pinService.clearPinKeyEncryptedUserKeyEphemeral).toHaveBeenCalledWith(mockUserId);
      });
    });
  });

  describe("setUserKeys", () => {
    let mockUserKey: UserKey;
    let mockEncPrivateKey: EncryptedString;
    let everHadUserKeyState: FakeSingleUserState<boolean>;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
      mockEncPrivateKey = new SymmetricCryptoKey(mockRandomBytes).toString() as EncryptedString;
      everHadUserKeyState = stateProvider.singleUser.getFake(mockUserId, USER_EVER_HAD_USER_KEY);

      // Initialize storage
      everHadUserKeyState.nextState(null);

      // Mock private key decryption
      encryptService.decryptToBytes.mockResolvedValue(mockRandomBytes);
    });

    it("throws if userKey is null", async () => {
      await expect(
        keyService.setUserKeys(null as unknown as UserKey, mockEncPrivateKey, mockUserId),
      ).rejects.toThrow("No userKey provided.");
    });

    it("throws if encPrivateKey is null", async () => {
      await expect(
        keyService.setUserKeys(mockUserKey, null as unknown as EncryptedString, mockUserId),
      ).rejects.toThrow("No encPrivateKey provided.");
    });

    it("throws if userId is null", async () => {
      await expect(
        keyService.setUserKeys(mockUserKey, mockEncPrivateKey, null as unknown as UserId),
      ).rejects.toThrow("No userId provided.");
    });

    it("throws if encPrivateKey cannot be decrypted with the userKey", async () => {
      encryptService.decryptToBytes.mockResolvedValue(null);

      await expect(
        keyService.setUserKeys(mockUserKey, mockEncPrivateKey, mockUserId),
      ).rejects.toThrow(UserPrivateKeyDecryptionFailedError);
    });

    // We already have tests for setUserKey, so we just need to test that the correct methods are called
    it("calls setUserKey with the userKey and userId", async () => {
      const setUserKeySpy = jest.spyOn(keyService, "setUserKey");

      await keyService.setUserKeys(mockUserKey, mockEncPrivateKey, mockUserId);

      expect(setUserKeySpy).toHaveBeenCalledWith(mockUserKey, mockUserId);
    });

    // We already have tests for setPrivateKey, so we just need to test that the correct methods are called
    // TODO: Move those tests into here since `setPrivateKey` will be converted to a private method
    it("calls setPrivateKey with the encPrivateKey and userId", async () => {
      const setEncryptedPrivateKeySpy = jest.spyOn(keyService, "setPrivateKey");

      await keyService.setUserKeys(mockUserKey, mockEncPrivateKey, mockUserId);

      expect(setEncryptedPrivateKeySpy).toHaveBeenCalledWith(mockEncPrivateKey, mockUserId);
    });
  });

  describe("clearKeys", () => {
    it("resolves active user id when called with no user id", async () => {
      let callCount = 0;
      stateProvider.activeUserId$ = stateProvider.activeUserId$.pipe(tap(() => callCount++));

      await keyService.clearKeys();
      expect(callCount).toBe(1);

      // revert to the original state
      accountService.activeAccount$ = accountService.activeAccountSubject.asObservable();
    });

    describe.each([
      USER_ENCRYPTED_ORGANIZATION_KEYS,
      USER_ENCRYPTED_PROVIDER_KEYS,
      USER_ENCRYPTED_PRIVATE_KEY,
      USER_KEY,
    ])("key removal", (key: UserKeyDefinition<unknown>) => {
      it(`clears ${key.key} for active user when unspecified`, async () => {
        await keyService.clearKeys();

        const encryptedOrgKeyState = stateProvider.singleUser.getFake(mockUserId, key);
        expect(encryptedOrgKeyState.nextMock).toHaveBeenCalledTimes(1);
        expect(encryptedOrgKeyState.nextMock).toHaveBeenCalledWith(null);
      });

      it(`clears ${key.key} for the specified user when specified`, async () => {
        const userId = "someOtherUser" as UserId;
        await keyService.clearKeys(userId);

        const encryptedOrgKeyState = stateProvider.singleUser.getFake(userId, key);
        expect(encryptedOrgKeyState.nextMock).toHaveBeenCalledTimes(1);
        expect(encryptedOrgKeyState.nextMock).toHaveBeenCalledWith(null);
      });
    });
  });

  describe("userPrivateKey$", () => {
    type SetupKeysParams = {
      makeMasterKey: boolean;
      makeUserKey: boolean;
    };

    function setupKeys({
      makeMasterKey,
      makeUserKey,
    }: SetupKeysParams): [UserKey | null, MasterKey | null] {
      const userKeyState = stateProvider.singleUser.getFake(mockUserId, USER_KEY);
      const fakeMasterKey = makeMasterKey ? makeSymmetricCryptoKey<MasterKey>(64) : null;
      masterPasswordService.masterKeySubject.next(fakeMasterKey);
      userKeyState.nextState(null);
      const fakeUserKey = makeUserKey ? makeSymmetricCryptoKey<UserKey>(64) : null;
      userKeyState.nextState(fakeUserKey);
      return [fakeUserKey, fakeMasterKey];
    }

    it("will return users decrypted private key when user has a user key and encrypted private key set", async () => {
      const [userKey] = setupKeys({
        makeMasterKey: false,
        makeUserKey: true,
      });

      const userEncryptedPrivateKeyState = stateProvider.singleUser.getFake(
        mockUserId,
        USER_ENCRYPTED_PRIVATE_KEY,
      );

      const fakeEncryptedUserPrivateKey = makeEncString("1");

      userEncryptedPrivateKeyState.nextState(fakeEncryptedUserPrivateKey.encryptedString!);

      // Decryption of the user private key
      const fakeDecryptedUserPrivateKey = makeStaticByteArray(10, 1);
      encryptService.decryptToBytes.mockResolvedValue(fakeDecryptedUserPrivateKey);

      const fakeUserPublicKey = makeStaticByteArray(10, 2);
      cryptoFunctionService.rsaExtractPublicKey.mockResolvedValue(fakeUserPublicKey);

      const userPrivateKey = await firstValueFrom(keyService.userPrivateKey$(mockUserId));

      expect(encryptService.decryptToBytes).toHaveBeenCalledWith(
        fakeEncryptedUserPrivateKey,
        userKey,
        "Content: Encrypted Private Key",
      );

      expect(userPrivateKey).toBe(fakeDecryptedUserPrivateKey);
    });

    it("returns null user private key when no user key is found", async () => {
      setupKeys({ makeMasterKey: false, makeUserKey: false });

      const userPrivateKey = await firstValueFrom(keyService.userPrivateKey$(mockUserId));

      expect(encryptService.decryptToBytes).not.toHaveBeenCalled();

      expect(userPrivateKey).toBeFalsy();
    });

    it("returns null when user does not have a private key set", async () => {
      setupKeys({ makeUserKey: true, makeMasterKey: false });

      const encryptedUserPrivateKeyState = stateProvider.singleUser.getFake(
        mockUserId,
        USER_ENCRYPTED_PRIVATE_KEY,
      );
      encryptedUserPrivateKeyState.nextState(null);

      const userPrivateKey = await firstValueFrom(keyService.userPrivateKey$(mockUserId));
      expect(userPrivateKey).toBeFalsy();
    });
  });

  describe("cipherDecryptionKeys$", () => {
    function fakePrivateKeyDecryption(encryptedPrivateKey: Encrypted, key: SymmetricCryptoKey) {
      const output = new Uint8Array(64);
      output.set(encryptedPrivateKey.dataBytes);
      output.set(
        key.key.subarray(0, 64 - encryptedPrivateKey.dataBytes.length),
        encryptedPrivateKey.dataBytes.length,
      );
      return output;
    }

    function fakeOrgKeyDecryption(encryptedString: EncString, userPrivateKey: Uint8Array) {
      const output = new Uint8Array(64);
      output.set(encryptedString.dataBytes);
      output.set(
        userPrivateKey.subarray(0, 64 - encryptedString.dataBytes.length),
        encryptedString.dataBytes.length,
      );
      return output;
    }

    const org1Id = "org1" as OrganizationId;

    type UpdateKeysParams = {
      userKey: UserKey;
      encryptedPrivateKey: EncString;
      orgKeys: Record<string, EncryptedOrganizationKeyData>;
      providerKeys: Record<string, EncryptedString>;
    };

    function updateKeys(keys: Partial<UpdateKeysParams> = {}) {
      if ("userKey" in keys) {
        const userKeyState = stateProvider.singleUser.getFake(mockUserId, USER_KEY);
        userKeyState.nextState(keys.userKey!);
      }

      if ("encryptedPrivateKey" in keys) {
        const userEncryptedPrivateKey = stateProvider.singleUser.getFake(
          mockUserId,
          USER_ENCRYPTED_PRIVATE_KEY,
        );
        userEncryptedPrivateKey.nextState(keys.encryptedPrivateKey!.encryptedString!);
      }

      if ("orgKeys" in keys) {
        const orgKeysState = stateProvider.singleUser.getFake(
          mockUserId,
          USER_ENCRYPTED_ORGANIZATION_KEYS,
        );
        orgKeysState.nextState(keys.orgKeys!);
      }

      if ("providerKeys" in keys) {
        const providerKeysState = stateProvider.singleUser.getFake(
          mockUserId,
          USER_ENCRYPTED_PROVIDER_KEYS,
        );
        providerKeysState.nextState(keys.providerKeys!);
      }

      encryptService.decryptToBytes.mockImplementation((encryptedPrivateKey, userKey) => {
        // TOOD: Branch between provider and private key?
        return Promise.resolve(fakePrivateKeyDecryption(encryptedPrivateKey, userKey));
      });

      encryptService.rsaDecrypt.mockImplementation((data, privateKey) => {
        return Promise.resolve(fakeOrgKeyDecryption(data, privateKey));
      });
    }

    it("returns decryption keys when there are no org or provider keys set", async () => {
      updateKeys({
        userKey: makeSymmetricCryptoKey<UserKey>(64),
        encryptedPrivateKey: makeEncString("privateKey"),
      });

      const decryptionKeys = await firstValueFrom(keyService.cipherDecryptionKeys$(mockUserId));

      expect(decryptionKeys).not.toBeNull();
      expect(decryptionKeys!.userKey).not.toBeNull();
      expect(decryptionKeys!.orgKeys).toEqual({});
    });

    it("returns decryption keys when there are org keys", async () => {
      updateKeys({
        userKey: makeSymmetricCryptoKey<UserKey>(64),
        encryptedPrivateKey: makeEncString("privateKey"),
        orgKeys: {
          [org1Id]: { type: "organization", key: makeEncString("org1Key").encryptedString! },
        },
      });

      const decryptionKeys = await firstValueFrom(keyService.cipherDecryptionKeys$(mockUserId));

      expect(decryptionKeys).not.toBeNull();
      expect(decryptionKeys!.userKey).not.toBeNull();
      expect(decryptionKeys!.orgKeys).not.toBeNull();
      expect(Object.keys(decryptionKeys!.orgKeys!)).toHaveLength(1);
      expect(decryptionKeys!.orgKeys![org1Id]).not.toBeNull();
      const orgKey = decryptionKeys!.orgKeys![org1Id];
      expect(orgKey.keyB64).toContain("org1Key");
    });

    it("returns decryption keys when there is an empty record for provider keys", async () => {
      updateKeys({
        userKey: makeSymmetricCryptoKey<UserKey>(64),
        encryptedPrivateKey: makeEncString("privateKey"),
        orgKeys: {
          [org1Id]: { type: "organization", key: makeEncString("org1Key").encryptedString! },
        },
        providerKeys: {},
      });

      const decryptionKeys = await firstValueFrom(keyService.cipherDecryptionKeys$(mockUserId));

      expect(decryptionKeys).not.toBeNull();
      expect(decryptionKeys!.userKey).not.toBeNull();
      expect(decryptionKeys!.orgKeys).not.toBeNull();
      expect(Object.keys(decryptionKeys!.orgKeys!)).toHaveLength(1);
      expect(decryptionKeys!.orgKeys![org1Id]).not.toBeNull();
      const orgKey = decryptionKeys!.orgKeys![org1Id];
      expect(orgKey.keyB64).toContain("org1Key");
    });

    it("returns decryption keys when some of the org keys are providers", async () => {
      const org2Id = "org2Id" as OrganizationId;
      updateKeys({
        userKey: makeSymmetricCryptoKey<UserKey>(64),
        encryptedPrivateKey: makeEncString("privateKey"),
        orgKeys: {
          [org1Id]: { type: "organization", key: makeEncString("org1Key").encryptedString! },
          [org2Id]: {
            type: "provider",
            key: makeEncString("provider1Key").encryptedString!,
            providerId: "provider1",
          },
        },
        providerKeys: {
          provider1: makeEncString("provider1Key").encryptedString!,
        },
      });

      const decryptionKeys = await firstValueFrom(keyService.cipherDecryptionKeys$(mockUserId));

      expect(decryptionKeys).not.toBeNull();
      expect(decryptionKeys!.userKey).not.toBeNull();
      expect(decryptionKeys!.orgKeys).not.toBeNull();
      expect(Object.keys(decryptionKeys!.orgKeys!)).toHaveLength(2);

      const orgKey = decryptionKeys!.orgKeys![org1Id];
      expect(orgKey).not.toBeNull();
      expect(orgKey.keyB64).toContain("org1Key");

      const org2Key = decryptionKeys!.orgKeys![org2Id];
      expect(org2Key).not.toBeNull();
      expect(org2Key.keyB64).toContain("provider1Key");
    });

    it("returns a stream that pays attention to updates of all data", async () => {
      // Start listening until there have been 6 emissions
      const promise = lastValueFrom(
        keyService.cipherDecryptionKeys$(mockUserId).pipe(bufferCount(6), take(1)),
      );

      // User has their UserKey set
      const initialUserKey = makeSymmetricCryptoKey<UserKey>(64);
      updateKeys({
        userKey: initialUserKey,
      });

      // Because switchMap is a little to good at its job
      await awaitAsync();

      // User has their private key set
      const initialPrivateKey = makeEncString("userPrivateKey");
      updateKeys({
        encryptedPrivateKey: initialPrivateKey,
      });

      // Because switchMap is a little to good at its job
      await awaitAsync();

      // Current architecture requires that provider keys are set before org keys
      updateKeys({
        providerKeys: {},
      });

      // Because switchMap is a little to good at its job
      await awaitAsync();

      // User has their org keys set
      updateKeys({
        orgKeys: {
          [org1Id]: { type: "organization", key: makeEncString("org1Key").encryptedString! },
        },
      });

      // Out of band user key update
      const updatedUserKey = makeSymmetricCryptoKey<UserKey>(64);
      updateKeys({
        userKey: updatedUserKey,
      });

      const emittedValues = await promise;

      // They start with no data
      expect(emittedValues[0]).toBeNull();

      // They get their user key set
      expect(emittedValues[1]).toEqual({
        userKey: initialUserKey,
        orgKeys: null,
      });

      // Once a private key is set we will attempt org key decryption, even if org keys haven't been set
      expect(emittedValues[2]).toEqual({
        userKey: initialUserKey,
        orgKeys: {},
      });

      // Will emit again when providers alone are set, but this won't change the output until orgs are set
      expect(emittedValues[3]).toEqual({
        userKey: initialUserKey,
        orgKeys: {},
      });

      // Expect org keys to get emitted
      expect(emittedValues[4]).toEqual({
        userKey: initialUserKey,
        orgKeys: {
          [org1Id]: expect.anything(),
        },
      });

      // Expect out of band user key update
      expect(emittedValues[5]).toEqual({
        userKey: updatedUserKey,
        orgKeys: {
          [org1Id]: expect.anything(),
        },
      });
    });
  });

  describe("compareKeyHash", () => {
    type TestCase = {
      masterKey: MasterKey;
      masterPassword: string | null;
      storedMasterKeyHash: string | null;
      mockReturnedHash: string;
      expectedToMatch: boolean;
    };

    const data: TestCase[] = [
      {
        masterKey: makeSymmetricCryptoKey(64),
        masterPassword: "my_master_password",
        storedMasterKeyHash: "bXlfaGFzaA==",
        mockReturnedHash: "bXlfaGFzaA==",
        expectedToMatch: true,
      },
      {
        masterKey: makeSymmetricCryptoKey(64),
        masterPassword: null,
        storedMasterKeyHash: "bXlfaGFzaA==",
        mockReturnedHash: "bXlfaGFzaA==",
        expectedToMatch: false,
      },
      {
        masterKey: makeSymmetricCryptoKey(64),
        masterPassword: null,
        storedMasterKeyHash: null,
        mockReturnedHash: "bXlfaGFzaA==",
        expectedToMatch: false,
      },
    ];

    it.each(data)(
      "returns expected match value when calculated hash equals stored hash",
      async ({
        masterKey,
        masterPassword,
        storedMasterKeyHash,
        mockReturnedHash,
        expectedToMatch,
      }) => {
        masterPasswordService.masterKeyHashSubject.next(storedMasterKeyHash);

        cryptoFunctionService.pbkdf2
          .calledWith(masterKey.key, masterPassword as string, "sha256", 2)
          .mockResolvedValue(Utils.fromB64ToArray(mockReturnedHash));

        const actualDidMatch = await keyService.compareKeyHash(
          masterPassword,
          masterKey,
          mockUserId,
        );

        expect(actualDidMatch).toBe(expectedToMatch);
      },
    );
  });
});
