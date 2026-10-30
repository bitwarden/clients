import { mock } from "jest-mock-extended";
import { BehaviorSubject, bufferCount, firstValueFrom, lastValueFrom, of, take } from "rxjs";

import { EncryptedOrganizationKeyData } from "@bitwarden/common/admin-console/models/data/encrypted-organization-key.data";
import { ProfileOrganizationResponse } from "@bitwarden/common/admin-console/models/response/profile-organization.response";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { USER_KEY } from "@bitwarden/common/key-management/state-definitions";
import { VaultTimeoutStringType } from "@bitwarden/common/key-management/vault-timeout";
import { VAULT_TIMEOUT } from "@bitwarden/common/key-management/vault-timeout/services/vault-timeout-settings.state";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { USER_ENCRYPTED_ORGANIZATION_KEYS } from "@bitwarden/common/platform/services/key-state/org-keys.state";
import { USER_ENCRYPTED_PROVIDER_KEYS } from "@bitwarden/common/platform/services/key-state/provider-keys.state";
import { USER_EVER_HAD_USER_KEY } from "@bitwarden/common/platform/services/key-state/user-key.state";
import { UserKeyDefinition } from "@bitwarden/common/platform/state";
import { ProfileProviderOrganizationResponse } from "@bitwarden/common/provider/models/response/profile-provider-organization.response";
import {
  makeEncString,
  makeStaticByteArray,
  makeSymmetricCryptoKey,
  FakeAccountService,
  mockAccountServiceWith,
  FakeStateProvider,
  FakeSingleUserState,
} from "@bitwarden/common/spec";
import { OrganizationId, ProviderId, UserId } from "@bitwarden/common/types/guid";
import { UserKey, ProviderKey } from "@bitwarden/common/types/key";
// eslint-disable-next-line no-restricted-imports
import {
  CryptoFunctionService,
  CsprngArray,
  EncryptedString,
  EncryptService,
  EncString,
  SymmetricCryptoKey,
  UnsignedPublicKey,
} from "@bitwarden/legacy-crypto";
import { Measurement } from "@bitwarden/logging";
import { WrappedAccountCryptographicState } from "@bitwarden/sdk-internal";

import { BiometricsService } from "./biometrics/biometric.service";
import { DefaultKeyService } from "./key.service";

describe("keyService", () => {
  let keyService: DefaultKeyService;

  const cryptoFunctionService = mock<CryptoFunctionService>();
  const encryptService = mock<EncryptService>();
  const platformUtilService = mock<PlatformUtilsService>();
  const logService = mock<LogService>({ startMeasurement: () => mock<Measurement>() });
  const stateService = mock<StateService>();
  const accountCryptographicStateService = mock<AccountCryptographicStateService>();
  const biometricsService = mock<BiometricsService>();
  const sdkService = mock<SdkService>();
  let stateProvider: FakeStateProvider;

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;

  beforeEach(async () => {
    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);

    await stateProvider.setUserState(VAULT_TIMEOUT, VaultTimeoutStringType.Never, mockUserId);

    Object.defineProperty(SdkLoadService, "Ready", {
      value: Promise.resolve(),
      configurable: true,
    });

    keyService = new DefaultKeyService(
      cryptoFunctionService,
      encryptService,
      platformUtilService,
      logService,
      stateService,
      stateProvider,
      accountCryptographicStateService,
      biometricsService,
      sdkService,
    );
  });

  const setUserKeyState = (userId: UserId, userKey: UserKey | null) => {
    stateProvider.singleUser.getFake(userId, USER_KEY).nextState(userKey);
  };

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it("instantiates", () => {
    expect(keyService).not.toBeFalsy();
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

  describe("userKey$", () => {
    it("does not re-emit when the same user key is written again", async () => {
      // Every emission makes cipher consumers decrypt the whole vault, e.g. after each sync.
      setUserKeyState(mockUserId, makeSymmetricCryptoKey<UserKey>(64, 0));

      const emitted: (UserKey | null)[] = [];
      const subscription = keyService.userKey$(mockUserId).subscribe((key) => emitted.push(key));
      setUserKeyState(mockUserId, makeSymmetricCryptoKey<UserKey>(64, 0));

      subscription.unsubscribe();
      expect(emitted).toHaveLength(1);
    });

    it("re-emits when the user key changes", async () => {
      setUserKeyState(mockUserId, makeSymmetricCryptoKey<UserKey>(64, 0));

      const emitted: (UserKey | null)[] = [];
      const subscription = keyService.userKey$(mockUserId).subscribe((key) => emitted.push(key));
      setUserKeyState(mockUserId, makeSymmetricCryptoKey<UserKey>(64, 1));

      subscription.unsubscribe();
      expect(emitted).toHaveLength(2);
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
      } as WrappedAccountCryptographicState | null);
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
    let accountStateSubject: BehaviorSubject<WrappedAccountCryptographicState | null>;

    beforeEach(() => {
      accountStateSubject = new BehaviorSubject<WrappedAccountCryptographicState | null>(null);
      accountCryptographicStateService.accountCryptographicState$.mockReturnValue(
        accountStateSubject.asObservable(),
      );

      encryptService.unwrapDecapsulationKey.mockImplementation((encryptedPrivateKey, userKey) => {
        return Promise.resolve(fakePrivateKeyDecryption(encryptedPrivateKey, userKey));
      });
      encryptService.unwrapSymmetricKey.mockImplementation((encryptedOrgKey, providerKey) => {
        return Promise.resolve(
          new SymmetricCryptoKey(fakeOrgKeyDecryption(encryptedOrgKey, providerKey.toEncoded())),
        );
      });

      encryptService.decapsulateKeyUnsigned.mockImplementation((data, privateKey) => {
        return Promise.resolve(new SymmetricCryptoKey(fakeOrgKeyDecryption(data, privateKey)));
      });
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
      expect(org2Key.keyB64).toContain("provider1Key");
    });

    it.skip("returns a stream that pays attention to updates of all data", async () => {
      jest.useFakeTimers();

      // Start listening until there have been 6 emissions
      const promise = lastValueFrom(
        keyService.cipherDecryptionKeys$(mockUserId).pipe(bufferCount(6), take(1)),
      );

      // User has their UserKey set
      const initialUserKey = makeSymmetricCryptoKey<UserKey>(64, 0);
      updateKeys({
        userKey: initialUserKey,
      });

      // Let the decryption chain settle before the next push, otherwise the outer switchMap
      // unsubscribes it and the emission never arrives
      await jest.advanceTimersByTimeAsync(0);

      // User has their private key set
      const initialPrivateKey = makeEncString("userPrivateKey");
      updateKeys({
        encryptedPrivateKey: initialPrivateKey,
      });

      await jest.advanceTimersByTimeAsync(0);

      // Current architecture requires that provider keys are set before org keys
      updateKeys({
        providerKeys: {},
      });

      await jest.advanceTimersByTimeAsync(0);

      // User has their org keys set
      updateKeys({
        orgKeys: {
          [org1Id]: { type: "organization", key: makeEncString("org1Key").encryptedString! },
        },
      });

      await jest.advanceTimersByTimeAsync(0);

      // Out of band user key update
      const updatedUserKey = makeSymmetricCryptoKey<UserKey>(64, 1);
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
          [org1Id]: expect.objectContaining({ keyB64: expect.stringContaining("org1Key") }),
        },
      });

      // Expect out of band user key update
      expect(emittedValues[5]).toEqual({
        userKey: updatedUserKey,
        orgKeys: {
          [org1Id]: expect.objectContaining({ keyB64: expect.stringContaining("org1Key") }),
        },
      });

      // The org key is decrypted with the user key, so the out of band update must produce a new
      // org key rather than replaying the one decrypted with the previous user key
      expect(emittedValues[5]!.orgKeys![org1Id].keyB64).not.toEqual(
        emittedValues[4]!.orgKeys![org1Id].keyB64,
      );
    });

    it("does not re-emit when a sync rewrites identical org and provider keys", async () => {
      // Every emission makes cipher consumers decrypt the whole vault.
      const orgKeys = {
        [org1Id]: { type: "organization" as const, key: makeEncString("org1Key").encryptedString! },
      };
      updateKeys({
        userKey: makeSymmetricCryptoKey<UserKey>(64),
        encryptedPrivateKey: makeEncString("privateKey"),
        providerKeys: {},
        orgKeys,
      });

      const emitted: unknown[] = [];
      const subscription = keyService
        .cipherDecryptionKeys$(mockUserId)
        .subscribe((keys) => emitted.push(keys));
      await new Promise(process.nextTick);

      updateKeys({ providerKeys: {} });
      await new Promise(process.nextTick);
      updateKeys({ orgKeys: { ...orgKeys } });
      await new Promise(process.nextTick);

      subscription.unsubscribe();
      expect(emitted).toHaveLength(1);
    });

    it("re-emits when an org key changes", async () => {
      updateKeys({
        userKey: makeSymmetricCryptoKey<UserKey>(64),
        encryptedPrivateKey: makeEncString("privateKey"),
        providerKeys: {},
        orgKeys: {
          [org1Id]: { type: "organization", key: makeEncString("org1Key").encryptedString! },
        },
      });

      const emitted: unknown[] = [];
      const subscription = keyService
        .cipherDecryptionKeys$(mockUserId)
        .subscribe((keys) => emitted.push(keys));
      await new Promise(process.nextTick);

      updateKeys({
        orgKeys: {
          [org1Id]: { type: "organization", key: makeEncString("org1KeyB").encryptedString! },
        },
      });
      await new Promise(process.nextTick);

      subscription.unsubscribe();
      expect(emitted).toHaveLength(2);
    });
  });

  describe("userEncryptionKeyPair$", () => {
    type SetupKeysParams = {
      makeUserKey: boolean;
    };

    function setupKeys({ makeUserKey }: SetupKeysParams): UserKey | null {
      const userKeyState = stateProvider.singleUser.getFake(mockUserId, USER_KEY);
      userKeyState.nextState(null);
      const fakeUserKey = makeUserKey ? makeSymmetricCryptoKey<UserKey>(64, 1) : null;
      userKeyState.nextState(fakeUserKey);
      return fakeUserKey;
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

  describe("encryptedOrgKeys$", () => {
    const org1Id = "org1" as OrganizationId;
    const org2Id = "org2" as OrganizationId;
    const provider1Id = "provider1" as ProviderId;

    let mockUserPrivateKey: Uint8Array;
    let mockUserPublicKey: Uint8Array;
    let mockProviderKeys: Record<ProviderId, ProviderKey>;
    let org1EncryptedKey: EncString;
    let org2ProviderEncryptedKey: EncString;

    beforeEach(() => {
      mockUserPrivateKey = makeStaticByteArray(64, 1);
      mockUserPublicKey = makeStaticByteArray(64, 2);
      mockProviderKeys = {
        [provider1Id]: makeSymmetricCryptoKey<ProviderKey>(64, 0),
      };
      org1EncryptedKey = makeEncString("org1Key");
      org2ProviderEncryptedKey = makeEncString("org2Key");

      stateProvider.singleUser.getFake(mockUserId, USER_ENCRYPTED_ORGANIZATION_KEYS).nextState({
        [org1Id]: { type: "organization", key: org1EncryptedKey.encryptedString! },
        [org2Id]: {
          type: "provider",
          key: org2ProviderEncryptedKey.encryptedString!,
          providerId: provider1Id,
        },
      });

      cryptoFunctionService.rsaExtractPublicKey.mockResolvedValue(mockUserPublicKey);
      encryptService.unwrapSymmetricKey.mockResolvedValue(makeSymmetricCryptoKey(64, 3));
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(makeEncString("reencryptedOrg2Key"));
    });

    it("returns an empty record when userPrivateKey is null", async () => {
      jest.spyOn(keyService, "userPrivateKey$").mockReturnValue(of(null));

      const result = await firstValueFrom(keyService.encryptedOrgKeys$(mockUserId));

      expect(result).toEqual({});
    });

    it("passes through user-encrypted org keys and re-encrypts provider-encrypted org keys with the user's public key", async () => {
      jest.spyOn(keyService, "userPrivateKey$").mockReturnValue(of(mockUserPrivateKey as any));
      jest.spyOn(keyService as any, "providerKeysHelper$").mockReturnValue(of(mockProviderKeys));

      const result = await firstValueFrom(keyService.encryptedOrgKeys$(mockUserId));

      expect(result).toEqual({
        [org1Id]: org1EncryptedKey,
        [org2Id]: makeEncString("reencryptedOrg2Key"),
      });
      expect(cryptoFunctionService.rsaExtractPublicKey).toHaveBeenCalledWith(mockUserPrivateKey);
      expect(encryptService.unwrapSymmetricKey).toHaveBeenCalledWith(
        org2ProviderEncryptedKey,
        mockProviderKeys[provider1Id],
      );
      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(
        makeSymmetricCryptoKey(64, 3),
        mockUserPublicKey,
      );
    });

    it("skips provider-encrypted org keys when there are no provider keys", async () => {
      jest.spyOn(keyService, "userPrivateKey$").mockReturnValue(of(mockUserPrivateKey as any));
      jest.spyOn(keyService as any, "providerKeysHelper$").mockReturnValue(of(null));

      const result = await firstValueFrom(keyService.encryptedOrgKeys$(mockUserId));

      expect(result).toEqual({ [org1Id]: org1EncryptedKey });
      expect(encryptService.encapsulateKeyUnsigned).not.toHaveBeenCalled();
    });
  });

  describe("setOrgKeys", () => {
    const org1Id = "org1" as OrganizationId;
    const org2Id = "org2" as OrganizationId;
    const staleOrgId = "staleOrg" as OrganizationId;
    const provider1Id = "provider1" as ProviderId;

    let mockUserPrivateKey: Uint8Array;
    let mockProviderKeys: Record<ProviderId, ProviderKey>;
    let org1EncryptedKey: EncString;
    let org2ProviderEncryptedKey: EncString;
    let reencryptedOrg2Key: EncString;
    let orgs: ProfileOrganizationResponse[];
    let providerOrgs: ProfileProviderOrganizationResponse[];
    let orgKeysState: FakeSingleUserState<Record<OrganizationId, EncryptedOrganizationKeyData>>;

    beforeEach(() => {
      mockUserPrivateKey = makeStaticByteArray(64, 1);
      mockProviderKeys = { [provider1Id]: makeSymmetricCryptoKey<ProviderKey>(64, 0) };
      org1EncryptedKey = makeEncString("org1Key");
      org2ProviderEncryptedKey = makeEncString("org2Key");
      reencryptedOrg2Key = makeEncString("reencryptedOrg2Key");
      orgs = [
        mock<ProfileOrganizationResponse>({ id: org1Id, key: org1EncryptedKey.encryptedString! }),
      ];
      providerOrgs = [
        mock<ProfileProviderOrganizationResponse>({
          id: org2Id,
          key: org2ProviderEncryptedKey.encryptedString!,
          providerId: provider1Id,
        }),
      ];

      orgKeysState = stateProvider.singleUser.getFake(mockUserId, USER_ENCRYPTED_ORGANIZATION_KEYS);
      orgKeysState.nextState({
        [staleOrgId]: { type: "organization", key: makeEncString("staleKey").encryptedString! },
      });

      cryptoFunctionService.rsaExtractPublicKey.mockResolvedValue(makeStaticByteArray(64, 2));
      encryptService.unwrapSymmetricKey.mockResolvedValue(makeSymmetricCryptoKey(64, 3));
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(reencryptedOrg2Key);
      sdkService.setOrgKeys.mockResolvedValue(undefined);
    });

    it("pushes the organization keys to the SDK before writing them to state", async () => {
      jest.spyOn(keyService, "userPrivateKey$").mockReturnValue(of(mockUserPrivateKey as any));
      jest.spyOn(keyService as any, "providerKeysHelper$").mockReturnValue(of(mockProviderKeys));
      let stateWritesAtPush: number | undefined;
      sdkService.setOrgKeys.mockImplementation(async () => {
        stateWritesAtPush = orgKeysState.nextMock.mock.calls.length;
      });

      await keyService.setOrgKeys(orgs, providerOrgs, mockUserId);

      expect(stateWritesAtPush).toBe(0);
      expect(sdkService.setOrgKeys.mock.invocationCallOrder[0]).toBeLessThan(
        orgKeysState.nextMock.mock.invocationCallOrder[0],
      );
      expect(orgKeysState.nextMock).toHaveBeenCalledWith({
        [org1Id]: { type: "organization", key: org1EncryptedKey.encryptedString },
        [org2Id]: {
          type: "provider",
          providerId: provider1Id,
          key: org2ProviderEncryptedKey.encryptedString,
        },
      });
    });

    it("pushes the given keys converted to the SDK form, without reading the stored keys", async () => {
      jest.spyOn(keyService, "userPrivateKey$").mockReturnValue(of(mockUserPrivateKey as any));
      jest.spyOn(keyService as any, "providerKeysHelper$").mockReturnValue(of(mockProviderKeys));
      const encryptedOrgKeysSpy = jest.spyOn(keyService, "encryptedOrgKeys$");

      await keyService.setOrgKeys(orgs, providerOrgs, mockUserId);

      expect(sdkService.setOrgKeys).toHaveBeenCalledWith(mockUserId, {
        [org1Id]: org1EncryptedKey.toJSON(),
        [org2Id]: reencryptedOrg2Key.toJSON(),
      });
      expect(encryptedOrgKeysSpy).not.toHaveBeenCalled();
    });

    it("skips the push but still writes state when the user private key is unavailable", async () => {
      jest.spyOn(keyService, "userPrivateKey$").mockReturnValue(of(null));

      await keyService.setOrgKeys(orgs, providerOrgs, mockUserId);

      expect(sdkService.setOrgKeys).not.toHaveBeenCalled();
      expect(orgKeysState.nextMock).toHaveBeenCalledTimes(1);
    });

    it("skips the push but still writes state when building the SDK keys fails", async () => {
      jest.spyOn(keyService, "userPrivateKey$").mockReturnValue(of(mockUserPrivateKey as any));
      jest.spyOn(keyService as any, "providerKeysHelper$").mockReturnValue(of(mockProviderKeys));
      encryptService.unwrapSymmetricKey.mockRejectedValue(new Error("decryption failed"));

      await keyService.setOrgKeys(orgs, providerOrgs, mockUserId);

      expect(logService.error).toHaveBeenCalled();
      expect(sdkService.setOrgKeys).not.toHaveBeenCalled();
      expect(orgKeysState.nextMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("buildSdkUnlockData", () => {
    const org1Id = "org1" as OrganizationId;
    const org2Id = "org2" as OrganizationId;
    const provider1Id = "provider1" as ProviderId;

    let userKey: UserKey;
    let accountCryptographicState: WrappedAccountCryptographicState;
    let mockEncryptedPrivateKey: EncryptedString;
    let mockUserPrivateKey: Uint8Array;
    let mockProviderKeys: Record<ProviderId, ProviderKey>;
    let org1EncryptedKey: EncString;
    let reencryptedOrg2Key: EncString;

    beforeEach(() => {
      userKey = makeSymmetricCryptoKey<UserKey>(64, 7);
      mockEncryptedPrivateKey = makeEncString("encryptedPrivateKey").encryptedString!;
      accountCryptographicState = { V1: { private_key: mockEncryptedPrivateKey } };
      mockUserPrivateKey = makeStaticByteArray(64, 1);
      mockProviderKeys = { [provider1Id]: makeSymmetricCryptoKey<ProviderKey>(64, 0) };
      org1EncryptedKey = makeEncString("org1Key");
      reencryptedOrg2Key = makeEncString("reencryptedOrg2Key");

      // A locked account: the user key is only available in memory.
      setUserKeyState(mockUserId, null);
      stateProvider.singleUser.getFake(mockUserId, USER_ENCRYPTED_ORGANIZATION_KEYS).nextState({
        [org1Id]: { type: "organization", key: org1EncryptedKey.encryptedString! },
        [org2Id]: {
          type: "provider",
          key: makeEncString("org2Key").encryptedString!,
          providerId: provider1Id,
        },
      });

      accountCryptographicStateService.accountCryptographicState$.mockReturnValue(
        of(accountCryptographicState),
      );
      encryptService.unwrapDecapsulationKey.mockResolvedValue(mockUserPrivateKey);
      cryptoFunctionService.rsaExtractPublicKey.mockResolvedValue(makeStaticByteArray(64, 2));
      encryptService.unwrapSymmetricKey.mockResolvedValue(makeSymmetricCryptoKey(64, 3));
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(reencryptedOrg2Key);
      jest.spyOn(keyService as any, "providerKeysHelper$").mockReturnValue(of(mockProviderKeys));
    });

    it("returns null and pushes nothing when the account cryptographic state is unavailable", async () => {
      accountCryptographicStateService.accountCryptographicState$.mockReturnValue(of(null));

      const result = await keyService.buildSdkUnlockData(mockUserId, userKey);

      expect(result).toBeNull();
      expect(encryptService.unwrapDecapsulationKey).not.toHaveBeenCalled();
      expect(sdkService.setOrgKeys).not.toHaveBeenCalled();
    });

    it("decrypts the private key with the given user key without reading the user key from state", async () => {
      const userKeySpy = jest.spyOn(keyService, "userKey$");

      await keyService.buildSdkUnlockData(mockUserId, userKey);

      expect(encryptService.unwrapDecapsulationKey).toHaveBeenCalledWith(
        new EncString(mockEncryptedPrivateKey),
        userKey,
      );
      expect((keyService as any).providerKeysHelper$).toHaveBeenCalledWith(
        mockUserId,
        mockUserPrivateKey,
      );
      expect(userKeySpy).not.toHaveBeenCalled();
    });

    it("returns the unlock request and the organization keys in the SDK form", async () => {
      const result = await keyService.buildSdkUnlockData(mockUserId, userKey);

      expect(result).toEqual({
        request: {
          userId: mockUserId,
          method: { decryptedKey: { decrypted_user_key: userKey.toSdk() } },
          accountCryptographicState,
        },
        orgKeys: {
          [org1Id]: org1EncryptedKey.toJSON(),
          [org2Id]: reencryptedOrg2Key.toJSON(),
        },
      });
    });

    it("returns no organization keys when the account has no private key", async () => {
      accountCryptographicStateService.accountCryptographicState$.mockReturnValue(
        of({ V1: { private_key: null } } as any),
      );

      const result = await keyService.buildSdkUnlockData(mockUserId, userKey);

      expect(result?.orgKeys).toEqual({});
      expect((keyService as any).providerKeysHelper$).not.toHaveBeenCalled();
    });

    it("returns the unlock request with no organization keys when none are stored", async () => {
      stateProvider.singleUser
        .getFake(mockUserId, USER_ENCRYPTED_ORGANIZATION_KEYS)
        .nextState(null);

      const result = await keyService.buildSdkUnlockData(mockUserId, userKey);

      expect(result).toEqual({
        request: {
          userId: mockUserId,
          method: { decryptedKey: { decrypted_user_key: userKey.toSdk() } },
          accountCryptographicState,
        },
        orgKeys: {},
      });
    });
  });

  describe("toUserEncryptedOrgKeys", () => {
    it("returns an empty record when userPrivateKey is null", async () => {
      const result = await (keyService as any).toUserEncryptedOrgKeys(
        {
          ["org1" as OrganizationId]: {
            type: "organization",
            key: makeEncString("org1Key").encryptedString!,
          },
        },
        null,
        null,
      );

      expect(result).toEqual({});
      expect(cryptoFunctionService.rsaExtractPublicKey).not.toHaveBeenCalled();
    });
  });

  describe("providerKeys$", () => {
    let mockUserPrivateKey: Uint8Array;
    let mockProviderKeys: Record<ProviderId, ProviderKey>;

    beforeEach(() => {
      mockUserPrivateKey = makeStaticByteArray(64, 1);
      mockProviderKeys = {
        ["provider1" as ProviderId]: makeSymmetricCryptoKey<ProviderKey>(64, 0),
        ["provider2" as ProviderId]: makeSymmetricCryptoKey<ProviderKey>(64, 1),
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
});
