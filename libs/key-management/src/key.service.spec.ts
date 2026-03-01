import { mock } from "jest-mock-extended";
import { BehaviorSubject, bufferCount, firstValueFrom, lastValueFrom, of, take } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { EncryptedOrganizationKeyData } from "@bitwarden/common/admin-console/models/data/encrypted-organization-key.data";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import {
  EncString,
  EncryptedString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { FakeMasterPasswordService } from "@bitwarden/common/key-management/master-password/services/fake-master-password.service";
import { UnsignedPublicKey } from "@bitwarden/common/key-management/types";
import { VaultTimeoutStringType } from "@bitwarden/common/key-management/vault-timeout";
import { VAULT_TIMEOUT } from "@bitwarden/common/key-management/vault-timeout/services/vault-timeout-settings.state";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { USER_ENCRYPTED_ORGANIZATION_KEYS } from "@bitwarden/common/platform/services/key-state/org-keys.state";
import { USER_ENCRYPTED_PROVIDER_KEYS } from "@bitwarden/common/platform/services/key-state/provider-keys.state";
import {
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
import { OrganizationId, ProviderId, UserId } from "@bitwarden/common/types/guid";
import {
  UserKey,
  UserPublicKey,
  OrgKey,
  ProviderKey,
} from "@bitwarden/common/types/key";

import { KdfConfigService } from "./abstractions/kdf-config.service";
import { DefaultKeyService } from "./key.service";
import { KdfConfig } from "./models/kdf-config";

describe("keyService", () => {
  let keyService: DefaultKeyService;

  const keyGenerationService = mock<KeyGenerationService>();
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const encryptService = mock<EncryptService>();
  const platformUtilService = mock<PlatformUtilsService>();
  const logService = mock<LogService>();
  const stateService = mock<StateService>();
  const kdfConfigService = mock<KdfConfigService>();
  const accountCryptographicStateService = mock<AccountCryptographicStateService>();
  let stateProvider: FakeStateProvider;

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;

  beforeEach(async () => {
    accountService = mockAccountServiceWith(mockUserId);
    masterPasswordService = new FakeMasterPasswordService();
    stateProvider = new FakeStateProvider(accountService);

    await stateProvider.setUserState(VAULT_TIMEOUT, VaultTimeoutStringType.Never, mockUserId);

    keyService = new DefaultKeyService(
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
      accountCryptographicStateService,
    );
  });

  const setUserKeyState = (userId: UserId, userKey: UserKey | null) => {
    stateProvider.singleUser
      .getFake(userId, USER_KEY)
      .nextState(userKey == null ? null : ({ "": userKey } as Record<string, UserKey>));
  };

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
      setUserKeyState(mockUserId, null);

      await expect(keyService.refreshAdditionalKeys(mockUserId)).rejects.toThrow(
        "No user key found for: " + mockUserId,
      );
    });

    it("refreshes additional keys when user key is available", async () => {
      const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      setUserKeyState(mockUserId, mockUserKey);
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
      setUserKeyState(mockUserId, mockUserKey);

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
      setUserKeyState(mockUserId, hasKey ? mockUserKey : null);
      expect(await keyService.hasUserKey(mockUserId)).toBe(hasKey);
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

      it("sets an Auto key if vault timeout is set to 10 minutes and is Cli", async () => {
        await stateProvider.setUserState(VAULT_TIMEOUT, 10, mockUserId);
        platformUtilService.getClientType.mockReturnValue(ClientType.Cli);

        await keyService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(mockUserKey.keyB64, {
          userId: mockUserId,
        });
      });

      it("clears the Auto key if vault timeout is set to 10 minutes", async () => {
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
      ];
      test.each(invalidUserIdTestCases)(
        "throws when keySuffix is $keySuffix and userId is $userId",
        async ({ keySuffix, userId }) => {
          await expect(keyService.clearStoredUserKey(userId)).rejects.toThrow("UserId is required");
        },
      );
    });

    describe("with Auto key suffix", () => {
      it("UserKeyAutoUnlock is cleared and pin keys are not cleared", async () => {
        await keyService.clearStoredUserKey(mockUserId);

        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
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

    describe.each([USER_ENCRYPTED_ORGANIZATION_KEYS, USER_ENCRYPTED_PROVIDER_KEYS, USER_KEY])(
      "key removal",
      (key: UserKeyDefinition<unknown>) => {
        it(`clears ${key.key} for the specified user when specified`, async () => {
          const userId = "someOtherUser" as UserId;
          await keyService.clearKeys(userId);

          const encryptedOrgKeyState = stateProvider.singleUser.getFake(userId, key);
          expect(encryptedOrgKeyState.nextMock).toHaveBeenCalledTimes(1);
          expect(encryptedOrgKeyState.nextMock).toHaveBeenCalledWith(null);
        });
      },
    );
  });

  describe("userPrivateKey$", () => {
    let mockUserKey: UserKey;
    let mockUserPrivateKey: Uint8Array;
    let mockEncryptedPrivateKey: EncryptedString;

    beforeEach(() => {
      mockUserKey = makeSymmetricCryptoKey<UserKey>(64);
      mockEncryptedPrivateKey = makeEncString("encryptedPrivateKey").encryptedString!;
      mockUserPrivateKey = makeStaticByteArray(10, 1);
      setUserKeyState(mockUserId, mockUserKey);
      accountCryptographicStateService.accountCryptographicState$.mockReturnValue(
        of({ V1: { private_key: mockEncryptedPrivateKey } }),
      );
      encryptService.unwrapDecapsulationKey.mockResolvedValue(mockUserPrivateKey);
    });

    it("returns the unwrapped user private key when user key and encrypted private key are set", async () => {
      const result = await firstValueFrom(keyService.userPrivateKey$(mockUserId));

      expect(result).toEqual(mockUserPrivateKey);
      expect(encryptService.unwrapDecapsulationKey).toHaveBeenCalledWith(
        new EncString(mockEncryptedPrivateKey),
        mockUserKey,
      );
    });

    it("emits null if unwrapping encrypted private key fails", async () => {
      encryptService.unwrapDecapsulationKey.mockImplementationOnce(() => {
        throw new Error("Unwrapping failed");
      });

      const result = await firstValueFrom(keyService.userPrivateKey$(mockUserId));
      expect(result).toBeNull();
    });

    it("returns null if user key is not set", async () => {
      setUserKeyState(mockUserId, null);

      const result = await firstValueFrom(keyService.userPrivateKey$(mockUserId));

      expect(result).toBeNull();
      expect(encryptService.unwrapDecapsulationKey).not.toHaveBeenCalled();
    });

    it("returns null if encrypted private key is not set", async () => {
      accountCryptographicStateService.accountCryptographicState$.mockReturnValue(of(null));

      const result = await firstValueFrom(keyService.userPrivateKey$(mockUserId));

      expect(result).toBeNull();
      expect(encryptService.unwrapDecapsulationKey).not.toHaveBeenCalled();
    });

    it("reacts to changes in user key or encrypted private key", async () => {
      // Initial state: both set
      const accountStateSubject = new BehaviorSubject({
        V1: { private_key: mockEncryptedPrivateKey },
      });
      accountCryptographicStateService.accountCryptographicState$.mockReturnValue(
        accountStateSubject.asObservable(),
      );

      let result = await firstValueFrom(keyService.userPrivateKey$(mockUserId));

      expect(result).toEqual(mockUserPrivateKey);

      // Change user key to null
      setUserKeyState(mockUserId, null);

      result = await firstValueFrom(keyService.userPrivateKey$(mockUserId));

      expect(result).toBeNull();

      // Restore user key, remove encrypted private key
      setUserKeyState(mockUserId, mockUserKey);
      accountStateSubject.next(null);

      result = await firstValueFrom(keyService.userPrivateKey$(mockUserId));

      expect(result).toBeNull();
    });
  });

  describe("cipherDecryptionKeys$", () => {
    let accountStateSubject: BehaviorSubject<any>;

    beforeEach(() => {
      accountStateSubject = new BehaviorSubject(null);
      accountCryptographicStateService.accountCryptographicState$.mockReturnValue(
        accountStateSubject.asObservable(),
      );
    });

    function fakePrivateKeyDecryption(encryptedPrivateKey: EncString, key: SymmetricCryptoKey) {
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
        setUserKeyState(mockUserId, keys.userKey!);
      }

      if ("encryptedPrivateKey" in keys) {
        accountStateSubject.next({
          V1: { private_key: keys.encryptedPrivateKey!.encryptedString! },
        });
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

  describe("makeOrgKey", () => {
    const mockUserPublicKey = new Uint8Array(64) as UserPublicKey;
    const shareKey = new SymmetricCryptoKey(new Uint8Array(64));
    const mockEncapsulatedKey = new EncString("mockEncapsulatedKey");

    beforeEach(() => {
      keyService.userPublicKey$ = jest
        .fn()
        .mockReturnValueOnce(new BehaviorSubject(mockUserPublicKey));
      keyGenerationService.createKey.mockResolvedValue(shareKey);
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(mockEncapsulatedKey);
    });

    it("creates a new OrgKey and encapsulates it with the user's public key", async () => {
      const result = await keyService.makeOrgKey<OrgKey>(mockUserId);

      expect(result).toEqual([mockEncapsulatedKey, shareKey as OrgKey]);
      expect(keyService.userPublicKey$).toHaveBeenCalledWith(mockUserId);
      expect(keyGenerationService.createKey).toHaveBeenCalledWith(512);
      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(
        shareKey,
        mockUserPublicKey,
      );
    });

    it("creates a new ProviderKey and encapsulates it with the user's public key", async () => {
      const result = await keyService.makeOrgKey<ProviderKey>(mockUserId);

      expect(result).toEqual([mockEncapsulatedKey, shareKey as ProviderKey]);
      expect(keyService.userPublicKey$).toHaveBeenCalledWith(mockUserId);
      expect(keyGenerationService.createKey).toHaveBeenCalledWith(512);
      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(
        shareKey,
        mockUserPublicKey,
      );
    });

    test.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userId is %s",
      async (userId) => {
        await expect(keyService.makeOrgKey(userId)).rejects.toThrow("UserId is required");

        expect(keyService.userPublicKey$).not.toHaveBeenCalled();
        expect(keyGenerationService.createKey).not.toHaveBeenCalled();
        expect(encryptService.encapsulateKeyUnsigned).not.toHaveBeenCalled();
      },
    );

    it("throws if the user's public key is not found", async () => {
      keyService.userPublicKey$ = jest.fn().mockReturnValueOnce(new BehaviorSubject(null));

      await expect(keyService.makeOrgKey(mockUserId)).rejects.toThrow(
        "No public key found for user " + mockUserId,
      );

      expect(keyGenerationService.createKey).not.toHaveBeenCalled();
      expect(encryptService.encapsulateKeyUnsigned).not.toHaveBeenCalled();
    });
  });

  describe("userEncryptionKeyPair$", () => {
    type SetupKeysParams = {
      makeUserKey: boolean;
    };

    function setupKeys({ makeUserKey }: SetupKeysParams): [UserKey] {
      const userKeyState = stateProvider.singleUser.getFake(mockUserId, USER_KEY);
      userKeyState.nextState(null);
      const fakeUserKey = makeUserKey ? makeSymmetricCryptoKey<UserKey>(64) : null;
      userKeyState.nextState(
        fakeUserKey == null ? null : ({ "": fakeUserKey } as Record<string, UserKey>),
      );
      return [fakeUserKey];
    }

    it("returns null when private key is null", async () => {
      setupKeys({ makeUserKey: false });

      keyService.userPrivateKey$ = jest.fn().mockReturnValue(new BehaviorSubject(null));
      const key = await firstValueFrom(keyService.userEncryptionKeyPair$(mockUserId));
      expect(key).toEqual(null);
    });

    it("returns null when private key is undefined", async () => {
      setupKeys({ makeUserKey: true });

      keyService.userPrivateKey$ = jest.fn().mockReturnValue(new BehaviorSubject(undefined));
      const key = await firstValueFrom(keyService.userEncryptionKeyPair$(mockUserId));
      expect(key).toEqual(null);
    });

    it("returns keys when private key is defined", async () => {
      setupKeys({ makeUserKey: false });

      keyService.userPrivateKey$ = jest.fn().mockReturnValue(new BehaviorSubject("private key"));
      cryptoFunctionService.rsaExtractPublicKey.mockResolvedValue(
        Utils.fromUtf8ToArray("public key") as UnsignedPublicKey,
      );
      const key = await firstValueFrom(keyService.userEncryptionKeyPair$(mockUserId));
      expect(key).toEqual({
        privateKey: "private key",
        publicKey: Utils.fromUtf8ToArray("public key") as UnsignedPublicKey,
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
        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      });
    });
  });

  describe("initAccount", () => {
    let userKey: UserKey;
    let mockPublicKey: string;
    let mockPrivateKey: EncString;

    beforeEach(() => {
      userKey = makeSymmetricCryptoKey<UserKey>(64);
      mockPublicKey = "mockPublicKey";
      mockPrivateKey = makeEncString("mockPrivateKey");

      keyGenerationService.createKey.mockResolvedValue(userKey);
      jest.spyOn(keyService, "makeKeyPair").mockResolvedValue([mockPublicKey, mockPrivateKey]);
      jest.spyOn(keyService, "setUserKey").mockResolvedValue();
    });

    test.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userId is %s",
      async (userId) => {
        await expect(keyService.initAccount(userId)).rejects.toThrow("UserId is required.");
        expect(keyService.setUserKey).not.toHaveBeenCalled();
      },
    );

    it("throws when user already has a user key", async () => {
      const existingUserKey = makeSymmetricCryptoKey<UserKey>(64);
      setUserKeyState(mockUserId, existingUserKey);

      await expect(keyService.initAccount(mockUserId)).rejects.toThrow(
        "Cannot initialize account, keys already exist.",
      );
      expect(logService.error).toHaveBeenCalledWith(
        "Tried to initialize account with existing user key.",
      );
      expect(keyService.setUserKey).not.toHaveBeenCalled();
    });

    it("throws when private key creation fails", async () => {
      // Simulate failure
      const invalidPrivateKey = new EncString(
        "2.AAAw2vTUePO+CCyokcIfVw==|DTBNlJ5yVsV2Bsk3UU3H6Q==|YvFBff5gxWqM+UsFB6BKimKxhC32AtjF3IStpU1Ijwg=",
      );
      invalidPrivateKey.encryptedString = null as unknown as EncryptedString;
      jest.spyOn(keyService, "makeKeyPair").mockResolvedValue([mockPublicKey, invalidPrivateKey]);

      await expect(keyService.initAccount(mockUserId)).rejects.toThrow(
        "Failed to create valid private key.",
      );
      expect(keyService.setUserKey).not.toHaveBeenCalled();
    });

    it("successfully initializes account with new keys", async () => {
      const keyCreationSize = 512;

      const result = await keyService.initAccount(mockUserId);

      expect(keyGenerationService.createKey).toHaveBeenCalledWith(keyCreationSize);
      expect(keyService.makeKeyPair).toHaveBeenCalledWith(userKey);
      expect(keyService.setUserKey).toHaveBeenCalledWith(userKey, mockUserId);
      expect(accountCryptographicStateService.setAccountCryptographicState).toHaveBeenCalledWith(
        { V1: { private_key: mockPrivateKey.encryptedString } },
        mockUserId,
      );
      expect(result).toEqual({
        userKey: userKey,
        publicKey: mockPublicKey,
        privateKey: mockPrivateKey,
      });
    });
  });

  describe("getFingerprint", () => {
    const mockFingerprintMaterial = "test@example.com";
    const mockPublicKey = new Uint8Array(256);
    const mockKeyFingerprint = Utils.fromB64ToArray("nfG2jTrJilBEsSrg7ffe9exE9PlClem4P2bxlQ6rNbs=");
    const mockUserFingerprint = Utils.fromB64ToArray(
      "V5AQSk83YXd6kZqCncC6d9J72R7UZ60Xl1eIoDoWgTc=",
    );
    const expectedFingerprint = ["predefine", "hunting", "pastime", "enrich", "unhearing"];

    beforeEach(() => {
      cryptoFunctionService.hash.mockResolvedValue(mockKeyFingerprint);
      cryptoFunctionService.hkdfExpand.mockResolvedValue(mockUserFingerprint);
    });

    test.each([null as unknown as Uint8Array, undefined as unknown as Uint8Array])(
      "throws when publicKey is %s",
      async (publicKey) => {
        await expect(keyService.getFingerprint(mockFingerprintMaterial, publicKey)).rejects.toThrow(
          "Public key is required to generate a fingerprint.",
        );
        expect(cryptoFunctionService.hash).not.toHaveBeenCalled();
        expect(cryptoFunctionService.hkdfExpand).not.toHaveBeenCalled();
      },
    );

    it("generates fingerprint successfully", async () => {
      const result = await keyService.getFingerprint(mockFingerprintMaterial, mockPublicKey);

      expect(result).toEqual(expectedFingerprint);
      expect(cryptoFunctionService.hash).toHaveBeenCalledWith(mockPublicKey, "sha256");
      expect(cryptoFunctionService.hkdfExpand).toHaveBeenCalledWith(
        mockKeyFingerprint,
        mockFingerprintMaterial,
        32,
        "sha256",
      );
    });

    it("throws when entropy of hash function is too small", async () => {
      const keyFingerprint = new Uint8Array(3);
      cryptoFunctionService.hash.mockResolvedValue(keyFingerprint);
      cryptoFunctionService.hkdfExpand.mockResolvedValue(new Uint8Array(3));

      await expect(
        keyService.getFingerprint(mockFingerprintMaterial, mockPublicKey),
      ).rejects.toThrow("Output entropy of hash function is too small");

      expect(cryptoFunctionService.hash).toHaveBeenCalledWith(mockPublicKey, "sha256");
      expect(cryptoFunctionService.hkdfExpand).toHaveBeenCalledWith(
        keyFingerprint,
        mockFingerprintMaterial,
        32,
        "sha256",
      );
    });
  });

  describe("providerKeys$", () => {
    let mockUserPrivateKey: Uint8Array;
    let mockProviderKeys: Record<ProviderId, ProviderKey>;

    beforeEach(() => {
      mockUserPrivateKey = makeStaticByteArray(64, 1);
      mockProviderKeys = {
        ["provider1" as ProviderId]: makeSymmetricCryptoKey<ProviderKey>(64),
        ["provider2" as ProviderId]: makeSymmetricCryptoKey<ProviderKey>(64),
      };
    });

    it("returns null when userPrivateKey is null", async () => {
      jest.spyOn(keyService, "userPrivateKey$").mockReturnValue(of(null));

      const result = await firstValueFrom(keyService.providerKeys$(mockUserId));

      expect(result).toBeNull();
    });

    it("returns provider keys when userPrivateKey is available", async () => {
      jest.spyOn(keyService, "userPrivateKey$").mockReturnValue(of(mockUserPrivateKey as any));
      jest.spyOn(keyService as any, "providerKeysHelper$").mockReturnValue(of(mockProviderKeys));

      const result = await firstValueFrom(keyService.providerKeys$(mockUserId));

      expect(result).toEqual(mockProviderKeys);
      expect((keyService as any).providerKeysHelper$).toHaveBeenCalledWith(
        mockUserId,
        mockUserPrivateKey,
      );
    });

    it("returns null when providerKeysHelper$ returns null", async () => {
      jest.spyOn(keyService, "userPrivateKey$").mockReturnValue(of(mockUserPrivateKey as any));
      jest.spyOn(keyService as any, "providerKeysHelper$").mockReturnValue(of(null));

      const result = await firstValueFrom(keyService.providerKeys$(mockUserId));

      expect(result).toBeNull();
    });
  });

  describe("makeKeyPair", () => {
    test.each([null as unknown as SymmetricCryptoKey, undefined as unknown as SymmetricCryptoKey])(
      "throws when the provided key is %s",
      async (key) => {
        await expect(keyService.makeKeyPair(key)).rejects.toThrow(
          "'key' is a required parameter and must be non-null.",
        );
      },
    );

    it("generates a key pair and returns public key and encrypted private key", async () => {
      const mockKey = new SymmetricCryptoKey(new Uint8Array(64));
      const mockKeyPair: [Uint8Array, Uint8Array] = [new Uint8Array(256), new Uint8Array(256)];
      const mockPublicKeyB64 = "mockPublicKeyB64";
      const mockPrivateKeyEncString = makeEncString("encryptedPrivateKey");

      cryptoFunctionService.rsaGenerateKeyPair.mockResolvedValue(mockKeyPair);
      jest.spyOn(Utils, "fromBufferToB64").mockReturnValue(mockPublicKeyB64);
      encryptService.wrapDecapsulationKey.mockResolvedValue(mockPrivateKeyEncString);

      const [publicKey, privateKey] = await keyService.makeKeyPair(mockKey);

      expect(cryptoFunctionService.rsaGenerateKeyPair).toHaveBeenCalledWith(2048);
      expect(Utils.fromBufferToB64).toHaveBeenCalledWith(mockKeyPair[0]);
      expect(encryptService.wrapDecapsulationKey).toHaveBeenCalledWith(mockKeyPair[1], mockKey);
      expect(publicKey).toBe(mockPublicKeyB64);
      expect(privateKey).toBe(mockPrivateKeyEncString);
    });
  });
});
