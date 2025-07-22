import { mock } from "jest-mock-extended";
import { BehaviorSubject, bufferCount, firstValueFrom, lastValueFrom, of, take } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { EncryptedOrganizationKeyData } from "@bitwarden/common/admin-console/models/data/encrypted-organization-key.data";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import {
  EncString,
  EncryptedString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { FakeMasterPasswordService } from "@bitwarden/common/key-management/master-password/services/fake-master-password.service";
import { VaultTimeoutStringType } from "@bitwarden/common/key-management/vault-timeout";
import { VAULT_TIMEOUT } from "@bitwarden/common/key-management/vault-timeout/services/vault-timeout-settings.state";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { Encrypted } from "@bitwarden/common/platform/interfaces/encrypted";
import { Utils } from "@bitwarden/common/platform/misc/utils";
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

  describe("refreshAdditionalKeys", () => {
    test.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userId is %s",
      async (userId) => {
        await expect(keyService.refreshAdditionalKeys(userId)).rejects.toThrow(
          "UserId is required",
        );
      },
    );

    it("throws error if user key not found", async () => {
      stateProvider.singleUser.getFake(mockUserId, USER_KEY).nextState(null);

      await expect(keyService.refreshAdditionalKeys(mockUserId)).rejects.toThrow(
        "No user key found for: " + mockUserId,
      );
    });

    it("refreshes additional keys when user key is available", async () => {
      const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      stateProvider.singleUser.getFake(mockUserId, USER_KEY).nextState(mockUserKey);
      const setUserKeySpy = jest.spyOn(keyService, "setUserKey");

      await keyService.refreshAdditionalKeys(mockUserId);

      expect(setUserKeySpy).toHaveBeenCalledWith(mockUserKey, mockUserId);
    });
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

  describe("hasUserKey", () => {
    let mockUserKey: UserKey;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
    });

    test.each([null as unknown as UserId, undefined as unknown as UserId])(
      "returns false when userId is %s",
      async (userId) => {
        expect(await keyService.hasUserKey(userId)).toBe(false);
      },
    );

    it.each([true, false])("returns %s if the user key is set", async (hasKey) => {
      stateProvider.singleUser.getFake(mockUserId, USER_KEY).nextState(hasKey ? mockUserKey : null);
      expect(await keyService.hasUserKey(mockUserId)).toBe(hasKey);
    });
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
    let everHadUserKeyState: FakeSingleUserState<boolean>;

    beforeEach(() => {
      everHadUserKeyState = stateProvider.singleUser.getFake(mockUserId, USER_EVER_HAD_USER_KEY);
    });

    it("should return true when stored value is true", async () => {
      everHadUserKeyState.nextState(true);

      expect(await firstValueFrom(keyService.everHadUserKey$(mockUserId))).toBe(true);
    });

    it("should return false when stored value is false", async () => {
      everHadUserKeyState.nextState(false);

      expect(await firstValueFrom(keyService.everHadUserKey$(mockUserId))).toBe(false);
    });

    it("should return false when stored value is null", async () => {
      everHadUserKeyState.nextState(null);

      expect(await firstValueFrom(keyService.everHadUserKey$(mockUserId))).toBe(false);
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
      encryptService.unwrapDecapsulationKey.mockResolvedValue(mockRandomBytes);
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
      encryptService.unwrapDecapsulationKey.mockResolvedValue(null);

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

  describe("makeSendKey", () => {
    const mockRandomBytes = new Uint8Array(16) as CsprngArray;
    it("calls keyGenerationService with expected hard coded parameters", async () => {
      await keyService.makeSendKey(mockRandomBytes);

      expect(keyGenerationService.deriveKeyFromMaterial).toHaveBeenCalledWith(
        mockRandomBytes,
        "bitwarden-send",
        "send",
      );
    });
  });

  describe("clearStoredUserKey", () => {
    describe("input validation", () => {
      const invalidUserIdTestCases = [
        { keySuffix: KeySuffixOptions.Auto, userId: null as unknown as UserId },
        { keySuffix: KeySuffixOptions.Auto, userId: undefined as unknown as UserId },
        { keySuffix: KeySuffixOptions.Pin, userId: null as unknown as UserId },
        { keySuffix: KeySuffixOptions.Pin, userId: undefined as unknown as UserId },
      ];
      test.each(invalidUserIdTestCases)(
        "throws when keySuffix is $keySuffix and userId is $userId",
        async ({ keySuffix, userId }) => {
          await expect(keyService.clearStoredUserKey(keySuffix, userId)).rejects.toThrow(
            "UserId is required",
          );
        },
      );
    });

    describe("with Auto key suffix", () => {
      it("UserKeyAutoUnlock is cleared and pin keys are not cleared", async () => {
        await keyService.clearStoredUserKey(KeySuffixOptions.Auto, mockUserId);

        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
        expect(pinService.clearPinKeyEncryptedUserKeyEphemeral).not.toHaveBeenCalled();
      });
    });

    describe("with PIN key suffix", () => {
      it("pin keys are cleared and user key auto unlock not", async () => {
        await keyService.clearStoredUserKey(KeySuffixOptions.Pin, mockUserId);

        expect(stateService.setUserKeyAutoUnlock).not.toHaveBeenCalled();
        expect(pinService.clearPinKeyEncryptedUserKeyEphemeral).toHaveBeenCalledWith(mockUserId);
      });
    });
  });

  describe("clearKeys", () => {
    test.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userId is %s",
      async (userId) => {
        await expect(keyService.clearKeys(userId)).rejects.toThrow("UserId is required");
      },
    );

    describe.each([
      USER_ENCRYPTED_ORGANIZATION_KEYS,
      USER_ENCRYPTED_PROVIDER_KEYS,
      USER_ENCRYPTED_PRIVATE_KEY,
      USER_KEY,
    ])("key removal", (key: UserKeyDefinition<unknown>) => {
      it(`clears ${key.key} for the specified user when specified`, async () => {
        const userId = "someOtherUser" as UserId;
        await keyService.clearKeys(userId);

        const encryptedOrgKeyState = stateProvider.singleUser.getFake(userId, key);
        expect(encryptedOrgKeyState.nextMock).toHaveBeenCalledTimes(1);
        expect(encryptedOrgKeyState.nextMock).toHaveBeenCalledWith(null);
      });
    });
  });

  describe("clearPinKeys", () => {
    test.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userId is %s",
      async (userId) => {
        await expect(keyService.clearPinKeys(userId)).rejects.toThrow("UserId is required");
      },
    );
    it("calls pin service to clear", async () => {
      const userId = "someOtherUser" as UserId;

      await keyService.clearPinKeys(userId);

      expect(pinService.clearPinKeyEncryptedUserKeyPersistent).toHaveBeenCalledWith(userId);
      expect(pinService.clearPinKeyEncryptedUserKeyEphemeral).toHaveBeenCalledWith(userId);
      expect(pinService.clearUserKeyEncryptedPin).toHaveBeenCalledWith(userId);
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
      encryptService.unwrapDecapsulationKey.mockResolvedValue(fakeDecryptedUserPrivateKey);

      const fakeUserPublicKey = makeStaticByteArray(10, 2);
      cryptoFunctionService.rsaExtractPublicKey.mockResolvedValue(fakeUserPublicKey);

      const userPrivateKey = await firstValueFrom(keyService.userPrivateKey$(mockUserId));

      expect(encryptService.unwrapDecapsulationKey).toHaveBeenCalledWith(
        fakeEncryptedUserPrivateKey,
        userKey,
      );

      expect(userPrivateKey).toBe(fakeDecryptedUserPrivateKey);
    });

    it("returns null user private key when no user key is found", async () => {
      setupKeys({ makeMasterKey: false, makeUserKey: false });

      const userPrivateKey = await firstValueFrom(keyService.userPrivateKey$(mockUserId));

      expect(encryptService.unwrapDecapsulationKey).not.toHaveBeenCalled();

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
        key.toEncoded().subarray(0, 64 - encryptedPrivateKey.dataBytes.length),
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

      encryptService.unwrapDecapsulationKey.mockImplementation((encryptedPrivateKey, userKey) => {
        return Promise.resolve(fakePrivateKeyDecryption(encryptedPrivateKey, userKey));
      });
      encryptService.unwrapSymmetricKey.mockImplementation((encryptedPrivateKey, userKey) => {
        return Promise.resolve(new SymmetricCryptoKey(new Uint8Array(64)));
      });

      encryptService.decapsulateKeyUnsigned.mockImplementation((data, privateKey) => {
        return Promise.resolve(new SymmetricCryptoKey(fakeOrgKeyDecryption(data, privateKey)));
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
      encryptService.decryptToBytes.mockResolvedValue(new Uint8Array(64));
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
      expect(org2Key.toEncoded()).toHaveLength(64);
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

  describe("getOrDeriveMasterKey", () => {
    it("returns the master key if it is already available", async () => {
      const getMasterKey = jest
        .spyOn(masterPasswordService, "masterKey$")
        .mockReturnValue(of("masterKey" as any));

      const result = await keyService.getOrDeriveMasterKey("password", mockUserId);

      expect(getMasterKey).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual("masterKey");
    });

    it("derives the master key if it is not available", async () => {
      const getMasterKey = jest
        .spyOn(masterPasswordService, "masterKey$")
        .mockReturnValue(of(null as any));

      const deriveKeyFromPassword = jest
        .spyOn(keyGenerationService, "deriveKeyFromPassword")
        .mockResolvedValue("mockMasterKey" as any);

      kdfConfigService.getKdfConfig$.mockReturnValue(of("mockKdfConfig" as any));

      const result = await keyService.getOrDeriveMasterKey("password", mockUserId);

      expect(getMasterKey).toHaveBeenCalledWith(mockUserId);
      expect(deriveKeyFromPassword).toHaveBeenCalledWith("password", "email", "mockKdfConfig");
      expect(result).toEqual("mockMasterKey");
    });

    it("throws an error if no user is found", async () => {
      accountService.activeAccountSubject.next(null);

      await expect(keyService.getOrDeriveMasterKey("password")).rejects.toThrow("No user found");
    });

    it("throws an error if no kdf config is found", async () => {
      jest.spyOn(masterPasswordService, "masterKey$").mockReturnValue(of(null as any));
      kdfConfigService.getKdfConfig$.mockReturnValue(of(null));

      await expect(keyService.getOrDeriveMasterKey("password", mockUserId)).rejects.toThrow(
        "No kdf found for user",
      );
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
          .calledWith(masterKey.inner().encryptionKey, masterPassword as string, "sha256", 2)
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

  describe("userPrivateKey$", () => {
    type SetupKeysParams = {
      makeMasterKey: boolean;
      makeUserKey: boolean;
    };

    function setupKeys({ makeMasterKey, makeUserKey }: SetupKeysParams): [UserKey, MasterKey] {
      const userKeyState = stateProvider.singleUser.getFake(mockUserId, USER_KEY);
      const fakeMasterKey = makeMasterKey ? makeSymmetricCryptoKey<MasterKey>(64) : null;
      masterPasswordService.masterKeySubject.next(fakeMasterKey);
      userKeyState.nextState(null);
      const fakeUserKey = makeUserKey ? makeSymmetricCryptoKey<UserKey>(64) : null;
      userKeyState.nextState(fakeUserKey);
      return [fakeUserKey, fakeMasterKey];
    }

    it("returns null when private key is null", async () => {
      setupKeys({ makeMasterKey: false, makeUserKey: false });

      keyService.userPrivateKey$ = jest.fn().mockReturnValue(new BehaviorSubject(null));
      const key = await firstValueFrom(keyService.userEncryptionKeyPair$(mockUserId));
      expect(key).toEqual(null);
    });

    it("returns null when private key is undefined", async () => {
      setupKeys({ makeUserKey: true, makeMasterKey: false });

      keyService.userPrivateKey$ = jest.fn().mockReturnValue(new BehaviorSubject(undefined));
      const key = await firstValueFrom(keyService.userEncryptionKeyPair$(mockUserId));
      expect(key).toEqual(null);
    });

    it("returns keys when private key is defined", async () => {
      setupKeys({ makeUserKey: false, makeMasterKey: true });

      keyService.userPrivateKey$ = jest.fn().mockReturnValue(new BehaviorSubject("private key"));
      cryptoFunctionService.rsaExtractPublicKey.mockResolvedValue(
        Utils.fromUtf8ToArray("public key"),
      );
      const key = await firstValueFrom(keyService.userEncryptionKeyPair$(mockUserId));
      expect(key).toEqual({
        privateKey: "private key",
        publicKey: Utils.fromUtf8ToArray("public key"),
      });
    });
  });

  describe("getUserKeyFromStorage", () => {
    let mockUserKey: UserKey;
    let validateUserKeySpy: jest.SpyInstance;

    beforeEach(() => {
      mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      validateUserKeySpy = jest.spyOn(keyService, "validateUserKey");
    });

    afterEach(() => {
      validateUserKeySpy.mockRestore();
    });

    describe("input validation", () => {
      const invalidUserIdTestCases = [
        { keySuffix: KeySuffixOptions.Auto, userId: null as unknown as UserId },
        { keySuffix: KeySuffixOptions.Auto, userId: undefined as unknown as UserId },
        { keySuffix: KeySuffixOptions.Pin, userId: null as unknown as UserId },
        { keySuffix: KeySuffixOptions.Pin, userId: undefined as unknown as UserId },
      ];

      test.each(invalidUserIdTestCases)(
        "throws when keySuffix is $keySuffix and userId is $userId",
        async ({ keySuffix, userId }) => {
          await expect(keyService.getUserKeyFromStorage(keySuffix, userId)).rejects.toThrow(
            "UserId is required",
          );
        },
      );
    });

    describe("with Pin keySuffix", () => {
      it("returns null and doesn't validate the key", async () => {
        const result = await keyService.getUserKeyFromStorage(KeySuffixOptions.Pin, mockUserId);

        expect(result).toBeNull();
        expect(validateUserKeySpy).not.toHaveBeenCalled();
      });
    });

    describe("with Auto keySuffix", () => {
      it("returns validated key from storage when key exists and is valid", async () => {
        stateService.getUserKeyAutoUnlock.mockResolvedValue(mockUserKey.keyB64);
        validateUserKeySpy.mockResolvedValue(true);

        const result = await keyService.getUserKeyFromStorage(KeySuffixOptions.Auto, mockUserId);

        expect(result).toEqual(mockUserKey);
        expect(validateUserKeySpy).toHaveBeenCalledWith(mockUserKey, mockUserId);
        expect(stateService.getUserKeyAutoUnlock).toHaveBeenCalledWith({
          userId: mockUserId,
        });
      });

      it("returns null when no key is found in storage", async () => {
        stateService.getUserKeyAutoUnlock.mockResolvedValue(null as unknown as string);

        const result = await keyService.getUserKeyFromStorage(KeySuffixOptions.Auto, mockUserId);

        expect(result).toBeNull();
        expect(validateUserKeySpy).not.toHaveBeenCalled();
      });

      it("clears stored keys when userKey validation fails", async () => {
        stateService.getUserKeyAutoUnlock.mockResolvedValue(mockUserKey.keyB64);
        validateUserKeySpy.mockResolvedValue(false);

        const result = await keyService.getUserKeyFromStorage(KeySuffixOptions.Auto, mockUserId);

        expect(result).toEqual(mockUserKey);
        expect(validateUserKeySpy).toHaveBeenCalledWith(mockUserKey, mockUserId);
        expect(logService.warning).toHaveBeenCalledWith("Invalid key, throwing away stored keys");
        expect(pinService.clearPinKeyEncryptedUserKeyEphemeral).toHaveBeenCalledWith(mockUserId);
        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      });
    });
  });
});
