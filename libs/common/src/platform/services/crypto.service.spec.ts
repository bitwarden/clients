import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { FakeAccountService, mockAccountServiceWith } from "../../../spec/fake-account-service";
import { FakeActiveUserState, FakeSingleUserState } from "../../../spec/fake-state";
import { FakeStateProvider } from "../../../spec/fake-state-provider";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { CsprngArray } from "../../types/csprng";
import { UserId } from "../../types/guid";
import { UserKey, MasterKey, PinKey } from "../../types/key";
import { CryptoFunctionService } from "../abstractions/crypto-function.service";
import { EncryptService } from "../abstractions/encrypt.service";
import { KeyGenerationService } from "../abstractions/key-generation.service";
import { LogService } from "../abstractions/log.service";
import { PlatformUtilsService } from "../abstractions/platform-utils.service";
import { StateService } from "../abstractions/state.service";
import { Utils } from "../misc/utils";
import { EncString } from "../models/domain/enc-string";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";
import { CryptoService } from "../services/crypto.service";

import { USER_ENCRYPTED_ORGANIZATION_KEYS } from "./key-state/org-keys.state";
import { USER_ENCRYPTED_PROVIDER_KEYS } from "./key-state/provider-keys.state";
import {
  USER_ENCRYPTED_PRIVATE_KEY,
  USER_EVER_HAD_USER_KEY,
  USER_KEY,
} from "./key-state/user-key.state";

describe("cryptoService", () => {
  let cryptoService: CryptoService;

  const keyGenerationService = mock<KeyGenerationService>();
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const encryptService = mock<EncryptService>();
  const platformUtilService = mock<PlatformUtilsService>();
  const logService = mock<LogService>();
  const stateService = mock<StateService>();
  let stateProvider: FakeStateProvider;

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);

    cryptoService = new CryptoService(
      keyGenerationService,
      cryptoFunctionService,
      encryptService,
      platformUtilService,
      logService,
      stateService,
      accountService,
      stateProvider,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("instantiates", () => {
    expect(cryptoService).not.toBeFalsy();
  });

  describe("getUserKey", () => {
    let mockUserKey: UserKey;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
    });

    it("retrieves the key state of the requested user", async () => {
      await cryptoService.getUserKey(mockUserId);

      expect(stateProvider.mock.getUserState$).toHaveBeenCalledWith(USER_KEY, mockUserId);
    });

    it("returns the User Key if available", async () => {
      stateProvider.singleUser.getFake(mockUserId, USER_KEY).nextState(mockUserKey);

      const userKey = await cryptoService.getUserKey(mockUserId);

      expect(userKey).toEqual(mockUserKey);
    });

    it("sets from the Auto key if the User Key if not set", async () => {
      const autoKeyB64 =
        "IT5cA1i5Hncd953pb00E58D2FqJX+fWTj4AvoI67qkGHSQPgulAqKv+LaKRAo9Bg0xzP9Nw00wk4TqjMmGSM+g==";
      stateService.getUserKeyAutoUnlock.mockResolvedValue(autoKeyB64);
      const setKeySpy = jest.spyOn(cryptoService, "setUserKey");

      const userKey = await cryptoService.getUserKey(mockUserId);

      expect(setKeySpy).toHaveBeenCalledWith(expect.any(SymmetricCryptoKey), mockUserId);
      expect(setKeySpy).toHaveBeenCalledTimes(1);

      expect(userKey.keyB64).toEqual(autoKeyB64);
    });

    it("returns nullish if there is no auto key and the user key is not set", async () => {
      const userKey = await cryptoService.getUserKey(mockUserId);

      expect(userKey).toBeFalsy();
    });
  });

  describe.each(["hasUserKey", "hasUserKeyInMemory"])(
    `%s`,
    (method: "hasUserKey" | "hasUserKeyInMemory") => {
      let mockUserKey: UserKey;

      beforeEach(() => {
        const mockRandomBytes = new Uint8Array(64) as CsprngArray;
        mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
      });

      it.each([true, false])("returns %s if the user key is set", async (hasKey) => {
        stateProvider.singleUser
          .getFake(mockUserId, USER_KEY)
          .nextState(hasKey ? mockUserKey : null);
        expect(await cryptoService[method](mockUserId)).toBe(hasKey);
      });

      it("returns false when no active userId is set", async () => {
        accountService.activeAccountSubject.next(null);
        expect(await cryptoService[method]()).toBe(false);
      });

      it.each([true, false])(
        "resolves %s for active user id when none is provided",
        async (hasKey) => {
          stateProvider.activeUserId$ = of(mockUserId);
          stateProvider.singleUser
            .getFake(mockUserId, USER_KEY)
            .nextState(hasKey ? mockUserKey : null);
          expect(await cryptoService[method]()).toBe(hasKey);
        },
      );
    },
  );

  describe("hasUserKey", () => {
    it.each([true, false])(
      "returns %s when the user key is not in memory, but the auto key is set",
      async (hasKey) => {
        stateProvider.singleUser.getFake(mockUserId, USER_KEY).nextState(null);
        cryptoService.hasUserKeyStored = jest.fn().mockResolvedValue(hasKey);
        expect(await cryptoService.hasUserKey(mockUserId)).toBe(hasKey);
      },
    );
  });

  describe("getUserKeyWithLegacySupport", () => {
    let mockUserKey: UserKey;
    let mockMasterKey: MasterKey;
    let stateSvcGetMasterKey: jest.SpyInstance;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
      mockMasterKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as MasterKey;

      stateSvcGetMasterKey = jest.spyOn(stateService, "getMasterKey");
    });

    it("returns the User Key if available", async () => {
      stateProvider.singleUser.getFake(mockUserId, USER_KEY).nextState(mockUserKey);
      const getKeySpy = jest.spyOn(cryptoService, "getUserKey");

      const userKey = await cryptoService.getUserKeyWithLegacySupport(mockUserId);

      expect(getKeySpy).toHaveBeenCalledWith(mockUserId);
      expect(stateSvcGetMasterKey).not.toHaveBeenCalled();

      expect(userKey).toEqual(mockUserKey);
    });

    it("returns the user's master key when User Key is not available", async () => {
      stateSvcGetMasterKey.mockResolvedValue(mockMasterKey);

      const userKey = await cryptoService.getUserKeyWithLegacySupport(mockUserId);

      expect(stateSvcGetMasterKey).toHaveBeenCalledWith({ userId: mockUserId });
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

      expect(await firstValueFrom(cryptoService.everHadUserKey$)).toBe(true);
    });

    it("should return false when stored value is false", async () => {
      everHadUserKeyState.nextState(false);

      expect(await firstValueFrom(cryptoService.everHadUserKey$)).toBe(false);
    });

    it("should return false when stored value is null", async () => {
      everHadUserKeyState.nextState(null);

      expect(await firstValueFrom(cryptoService.everHadUserKey$)).toBe(false);
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
      await cryptoService.setUserKey(mockUserKey, mockUserId);

      expect(await firstValueFrom(everHadUserKeyState.state$)).toBe(true);
    });

    describe("Auto Key refresh", () => {
      it("sets an Auto key if vault timeout is set to null", async () => {
        stateService.getVaultTimeout.mockResolvedValue(null);

        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(mockUserKey.keyB64, {
          userId: mockUserId,
        });
      });

      it("clears the Auto key if vault timeout is set to anything other than null", async () => {
        stateService.getVaultTimeout.mockResolvedValue(10);

        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      });

      it("clears the old deprecated Auto key whenever a User Key is set", async () => {
        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setCryptoMasterKeyAuto).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      });
    });

    it("throws if key is null", async () => {
      await expect(cryptoService.setUserKey(null, mockUserId)).rejects.toThrow("No key provided.");
    });

    it("should update the user's lock state", async () => {
      await cryptoService.setUserKey(mockUserKey, mockUserId);

      expect(accountService.mock.setAccountStatus).toHaveBeenCalledWith(
        mockUserId,
        AuthenticationStatus.Unlocked,
      );
    });

    describe("Pin Key refresh", () => {
      let cryptoSvcMakePinKey: jest.SpyInstance;
      const protectedPin =
        "2.jcow2vTUePO+CCyokcIfVw==|DTBNlJ5yVsV2Bsk3UU3H6Q==|YvFBff5gxWqM+UsFB6BKimKxhC32AtjF3IStpU1Ijwg=";
      let encPin: EncString;

      beforeEach(() => {
        cryptoSvcMakePinKey = jest.spyOn(cryptoService, "makePinKey");
        cryptoSvcMakePinKey.mockResolvedValue(new SymmetricCryptoKey(new Uint8Array(64)) as PinKey);
        encPin = new EncString(
          "2.jcow2vTUePO+CCyokcIfVw==|DTBNlJ5yVsV2Bsk3UU3H6Q==|YvFBff5gxWqM+UsFB6BKimKxhC32AtjF3IStpU1Ijwg=",
        );
        encryptService.encrypt.mockResolvedValue(encPin);
      });

      it("sets a UserKeyPin if a ProtectedPin and UserKeyPin is set", async () => {
        stateService.getProtectedPin.mockResolvedValue(protectedPin);
        stateService.getPinKeyEncryptedUserKey.mockResolvedValue(
          new EncString(
            "2.OdGNE3L23GaDZGvu9h2Brw==|/OAcNnrYwu0rjiv8+RUr3Tc+Ef8fV035Tm1rbTxfEuC+2LZtiCAoIvHIZCrM/V1PWnb/pHO2gh9+Koks04YhX8K29ED4FzjeYP8+YQD/dWo=|+12xTcIK/UVRsOyawYudPMHb6+lCHeR2Peq1pQhPm0A=",
          ),
        );

        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setPinKeyEncryptedUserKey).toHaveBeenCalledWith(expect.any(EncString), {
          userId: mockUserId,
        });
      });

      it("sets a PinKeyEphemeral if a ProtectedPin is set, but a UserKeyPin is not set", async () => {
        stateService.getProtectedPin.mockResolvedValue(protectedPin);
        stateService.getPinKeyEncryptedUserKey.mockResolvedValue(null);

        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setPinKeyEncryptedUserKeyEphemeral).toHaveBeenCalledWith(
          expect.any(EncString),
          {
            userId: mockUserId,
          },
        );
      });

      it("clears the UserKeyPin and UserKeyPinEphemeral if the ProtectedPin is not set", async () => {
        stateService.getProtectedPin.mockResolvedValue(null);

        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setPinKeyEncryptedUserKey).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
        expect(stateService.setPinKeyEncryptedUserKeyEphemeral).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      });
    });
  });

  describe("clearUserKey", () => {
    it.each([mockUserId, null])("should clear the User Key for id %2", async (userId) => {
      await cryptoService.clearUserKey(false, userId);

      expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(USER_KEY, null, userId);
    });

    it("should update status to locked", async () => {
      await cryptoService.clearUserKey(false, mockUserId);

      expect(accountService.mock.setMaxAccountStatus).toHaveBeenCalledWith(
        mockUserId,
        AuthenticationStatus.Locked,
      );
    });

    it.each([true, false])(
      "should clear stored user keys if clearAll is true (%s)",
      async (clear) => {
        const clearSpy = (cryptoService["clearAllStoredUserKeys"] = jest.fn());
        await cryptoService.clearUserKey(clear, mockUserId);

        if (clear) {
          expect(clearSpy).toHaveBeenCalledWith(mockUserId);
          expect(clearSpy).toHaveBeenCalledTimes(1);
        } else {
          expect(clearSpy).not.toHaveBeenCalled();
        }
      },
    );
  });

  describe("clearOrgKeys", () => {
    let forceMemorySpy: jest.Mock;
    beforeEach(() => {
      forceMemorySpy = cryptoService["activeUserOrgKeysState"].forceValue = jest.fn();
    });
    it("clears in memory org keys when called with memoryOnly", async () => {
      await cryptoService.clearOrgKeys(true);

      expect(forceMemorySpy).toHaveBeenCalledWith({});
    });

    it("does not clear memory when called with the non active user and memory only", async () => {
      await cryptoService.clearOrgKeys(true, "someOtherUser" as UserId);

      expect(forceMemorySpy).not.toHaveBeenCalled();
    });

    it("does not write to disk state if called with memory only", async () => {
      await cryptoService.clearOrgKeys(true);

      expect(stateProvider.singleUser.mock.get).not.toHaveBeenCalled();
    });

    it("clears disk state when called with diskOnly", async () => {
      await cryptoService.clearOrgKeys(false);

      expect(stateProvider.singleUser.mock.get).toHaveBeenCalledWith(
        mockUserId,
        USER_ENCRYPTED_ORGANIZATION_KEYS,
      );
      expect(
        stateProvider.singleUser.getFake(mockUserId, USER_ENCRYPTED_ORGANIZATION_KEYS).nextMock,
      ).toHaveBeenCalledWith(null);
    });

    it("clears another user's disk state when called with diskOnly and that user", async () => {
      await cryptoService.clearOrgKeys(false, "someOtherUser" as UserId);

      expect(stateProvider.singleUser.mock.get).toHaveBeenCalledWith(
        "someOtherUser" as UserId,
        USER_ENCRYPTED_ORGANIZATION_KEYS,
      );
      expect(
        stateProvider.singleUser.getFake(
          "someOtherUser" as UserId,
          USER_ENCRYPTED_ORGANIZATION_KEYS,
        ).nextMock,
      ).toHaveBeenCalledWith(null);
    });

    it("does not clear active user disk state when called with diskOnly and a different specified user", async () => {
      await cryptoService.clearOrgKeys(false, "someOtherUser" as UserId);

      expect(stateProvider.singleUser.mock.get).not.toHaveBeenCalledWith(
        mockUserId,
        USER_ENCRYPTED_ORGANIZATION_KEYS,
      );
    });
  });

  describe("clearProviderKeys", () => {
    let forceMemorySpy: jest.Mock;
    beforeEach(() => {
      forceMemorySpy = cryptoService["activeUserProviderKeysState"].forceValue = jest.fn();
    });
    it("clears in memory org keys when called with memoryOnly", async () => {
      await cryptoService.clearProviderKeys(true);

      expect(forceMemorySpy).toHaveBeenCalledWith({});
    });

    it("does not clear memory when called with the non active user and memory only", async () => {
      await cryptoService.clearProviderKeys(true, "someOtherUser" as UserId);

      expect(forceMemorySpy).not.toHaveBeenCalled();
    });

    it("does not write to disk state if called with memory only", async () => {
      await cryptoService.clearProviderKeys(true);

      expect(stateProvider.singleUser.mock.get).not.toHaveBeenCalled();
    });

    it("clears disk state when called with diskOnly", async () => {
      await cryptoService.clearProviderKeys(false);

      expect(stateProvider.singleUser.mock.get).toHaveBeenCalledWith(
        mockUserId,
        USER_ENCRYPTED_PROVIDER_KEYS,
      );
      expect(
        stateProvider.singleUser.getFake(mockUserId, USER_ENCRYPTED_PROVIDER_KEYS).nextMock,
      ).toHaveBeenCalledWith(null);
    });

    it("clears another user's disk state when called with diskOnly and that user", async () => {
      await cryptoService.clearProviderKeys(false, "someOtherUser" as UserId);

      expect(stateProvider.singleUser.mock.get).toHaveBeenCalledWith(
        "someOtherUser" as UserId,
        USER_ENCRYPTED_PROVIDER_KEYS,
      );
      expect(
        stateProvider.singleUser.getFake("someOtherUser" as UserId, USER_ENCRYPTED_PROVIDER_KEYS)
          .nextMock,
      ).toHaveBeenCalledWith(null);
    });

    it("does not clear active user disk state when called with diskOnly and a different specified user", async () => {
      await cryptoService.clearProviderKeys(false, "someOtherUser" as UserId);

      expect(stateProvider.singleUser.mock.get).not.toHaveBeenCalledWith(
        mockUserId,
        USER_ENCRYPTED_PROVIDER_KEYS,
      );
    });
  });

  describe("clearKeyPair", () => {
    let forceMemoryPrivateKeySpy: jest.Mock;
    let forceMemoryPublicKeySpy: jest.Mock;
    beforeEach(() => {
      forceMemoryPrivateKeySpy = cryptoService["activeUserPrivateKeyState"].forceValue = jest.fn();
      forceMemoryPublicKeySpy = cryptoService["activeUserPublicKeyState"].forceValue = jest.fn();
    });
    it("clears in memory org keys when called with memoryOnly", async () => {
      await cryptoService.clearKeyPair(true);

      expect(forceMemoryPrivateKeySpy).toHaveBeenCalledWith(null);
      expect(forceMemoryPublicKeySpy).toHaveBeenCalledWith(null);
    });

    it("does not clear memory when called with the non active user and memory only", async () => {
      await cryptoService.clearKeyPair(true, "someOtherUser" as UserId);

      expect(forceMemoryPrivateKeySpy).not.toHaveBeenCalled();
      expect(forceMemoryPublicKeySpy).not.toHaveBeenCalled();
    });

    it("does not write to disk state if called with memory only", async () => {
      await cryptoService.clearKeyPair(true);

      expect(stateProvider.singleUser.mock.get).not.toHaveBeenCalled();
    });

    it("clears disk state when called with diskOnly", async () => {
      await cryptoService.clearKeyPair(false);

      expect(stateProvider.singleUser.mock.get).toHaveBeenCalledWith(
        mockUserId,
        USER_ENCRYPTED_PRIVATE_KEY,
      );
      expect(
        stateProvider.singleUser.getFake(mockUserId, USER_ENCRYPTED_PRIVATE_KEY).nextMock,
      ).toHaveBeenCalledWith(null);
    });

    it("clears another user's disk state when called with diskOnly and that user", async () => {
      await cryptoService.clearKeyPair(false, "someOtherUser" as UserId);

      expect(stateProvider.singleUser.mock.get).toHaveBeenCalledWith(
        "someOtherUser" as UserId,
        USER_ENCRYPTED_PRIVATE_KEY,
      );
      expect(
        stateProvider.singleUser.getFake("someOtherUser" as UserId, USER_ENCRYPTED_PRIVATE_KEY)
          .nextMock,
      ).toHaveBeenCalledWith(null);
    });

    it("does not clear active user disk state when called with diskOnly and a different specified user", async () => {
      await cryptoService.clearKeyPair(false, "someOtherUser" as UserId);

      expect(stateProvider.singleUser.mock.get).not.toHaveBeenCalledWith(
        mockUserId,
        USER_ENCRYPTED_PRIVATE_KEY,
      );
    });
  });

  describe("clearUserKey", () => {
    it("clears the user key for the active user when no userId is specified", async () => {
      await cryptoService.clearUserKey(false);
      expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(USER_KEY, null, undefined);
    });

    it("clears the user key for the specified user when a userId is specified", async () => {
      await cryptoService.clearUserKey(false, "someOtherUser" as UserId);
      expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(USER_KEY, null, "someOtherUser");
    });

    it("sets the maximum account status of the active user id to locked when user id is not specified", async () => {
      await cryptoService.clearUserKey(false);
      expect(accountService.mock.setMaxAccountStatus).toHaveBeenCalledWith(
        mockUserId,
        AuthenticationStatus.Locked,
      );
    });

    it("sets the maximum account status of the specified user id to locked when user id is specified", async () => {
      await cryptoService.clearUserKey(false, "someOtherUser" as UserId);
      expect(accountService.mock.setMaxAccountStatus).toHaveBeenCalledWith(
        "someOtherUser" as UserId,
        AuthenticationStatus.Locked,
      );
    });

    it("clears all stored user keys when clearAll is true", async () => {
      const clearAllSpy = (cryptoService["clearAllStoredUserKeys"] = jest.fn());
      await cryptoService.clearUserKey(true);
      expect(clearAllSpy).toHaveBeenCalledWith(mockUserId);
    });
  });
});
