import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { USER_EVER_HAD_USER_KEY } from "@bitwarden/common/platform/services/key-state/user-key.state";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsService, BiometricStateService, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { CsprngArray, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { EncString, UnsignedSharedKey } from "@bitwarden/sdk-internal";
import { StateProvider } from "@bitwarden/state";

import { AutoUnlockService } from "./auto-unlock.service";
import { DefaultUnlockService } from "./default-unlock.service";
import { UnlockMethod } from "./unlock-method.enum";

const mockUserId = "b1e2d3c4-a1b2-c3d4-e5f6-a1b2c3d4e5f6" as UserId;
const mockPin = "1234";
const mockMasterPassword = "master-password";
const mockAccountCryptographicState = { some: "state" } as any;
const mockMasterPasswordUnlockData = { some: "unlockData", salt: "salt", kdf: "pbkdf2" } as any;
const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;

describe("DefaultUnlockService", () => {
  const accountCryptographicStateService = mock<AccountCryptographicStateService>();
  const masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
  const stateProvider = mock<StateProvider>();
  const logService = mock<LogService>();
  const biometricsService = mock<BiometricsService>();
  const biometricStateService = mock<BiometricStateService>();
  const keyService = mock<KeyService>();
  const sdkService = mock<SdkService>();
  const autoUnlockService = mock<AutoUnlockService>();

  let service: DefaultUnlockService;

  beforeEach(() => {
    jest.resetAllMocks();

    accountCryptographicStateService.accountCryptographicState$.mockReturnValue(
      of(mockAccountCryptographicState),
    );
    masterPasswordService.masterPasswordUnlockData$.mockReturnValue(
      of({ toSdk: () => mockMasterPasswordUnlockData } as any),
    );
    autoUnlockService.setAutoUnlockKey.mockResolvedValue(undefined);
    biometricsService.setBiometricProtectedUnlockKeyForUser.mockResolvedValue(undefined);
    biometricStateService.biometricUnlockEnabled$.mockReturnValue(of(true));
    sdkService.unlock.mockResolvedValue(mockUserKey);
    sdkService.setOrgKeys.mockResolvedValue(undefined);
    sdkService.cryptoReady$.mockReturnValue(of(true));
    keyService.buildSdkUnlockData.mockResolvedValue(null);

    const mockStateUpdate = jest.fn().mockResolvedValue(undefined);
    stateProvider.getUser.mockReturnValue({ update: mockStateUpdate } as any);
    stateProvider.setUserState.mockResolvedValue(undefined);

    service = new DefaultUnlockService(
      accountCryptographicStateService,
      masterPasswordService,
      stateProvider,
      logService,
      biometricsService,
      biometricStateService,
      keyService,
      sdkService,
      autoUnlockService,
    );
  });

  describe("unlockWithPin", () => {
    it("unlocks the SDK client with the pin method", async () => {
      await service.unlockWithPin(mockUserId, mockPin);

      expect(sdkService.unlock).toHaveBeenCalledWith(mockUserId, {
        userId: mockUserId,
        accountCryptographicState: mockAccountCryptographicState,
        method: {
          pinState: {
            pin: mockPin,
          },
        },
      });
    });

    it("sets unlock side effects after successful unlock", async () => {
      await service.unlockWithPin(mockUserId, mockPin);

      expect(biometricsService.setBiometricProtectedUnlockKeyForUser).toHaveBeenCalledWith(
        mockUserId,
        mockUserKey,
      );
      expect(autoUnlockService.setAutoUnlockKey).toHaveBeenCalledWith(mockUserId, mockUserKey);
      expect(stateProvider.setUserState).toHaveBeenCalledWith(
        USER_EVER_HAD_USER_KEY,
        true,
        mockUserId,
      );
    });
  });

  describe("unlockWithMasterPassword", () => {
    it("unlocks the SDK client with the master password method", async () => {
      await service.unlockWithMasterPassword(mockUserId, mockMasterPassword);

      expect(sdkService.unlock).toHaveBeenCalledWith(mockUserId, {
        userId: mockUserId,
        accountCryptographicState: mockAccountCryptographicState,
        method: {
          masterPasswordUnlock: {
            password: mockMasterPassword,
            master_password_unlock: mockMasterPasswordUnlockData,
          },
        },
      });
    });

    it("sets unlock side effects after successful unlock", async () => {
      await service.unlockWithMasterPassword(mockUserId, mockMasterPassword);

      expect(biometricsService.setBiometricProtectedUnlockKeyForUser).toHaveBeenCalledWith(
        mockUserId,
        mockUserKey,
      );
      expect(autoUnlockService.setAutoUnlockKey).toHaveBeenCalledWith(mockUserId, mockUserKey);
      expect(stateProvider.setUserState).toHaveBeenCalledWith(
        USER_EVER_HAD_USER_KEY,
        true,
        mockUserId,
      );
    });
  });

  describe("unlockWithBiometrics", () => {
    const biometricsUserKey = new SymmetricCryptoKey(
      new Uint8Array(64).fill(1) as CsprngArray,
    ) as UserKey;

    it("unlocks the SDK client with the decrypted key from biometrics", async () => {
      biometricsService.unlockWithBiometricsForUser.mockResolvedValue(biometricsUserKey);

      await service.unlockWithBiometrics(mockUserId);

      expect(biometricsService.unlockWithBiometricsForUser).toHaveBeenCalledWith(mockUserId);
      expect(sdkService.unlock).toHaveBeenCalledWith(mockUserId, {
        userId: mockUserId,
        accountCryptographicState: mockAccountCryptographicState,
        method: {
          decryptedKey: {
            decrypted_user_key: biometricsUserKey.toBase64(),
          },
        },
      });
    });

    it("throws when biometrics returns null", async () => {
      biometricsService.unlockWithBiometricsForUser.mockResolvedValue(null);

      await expect(service.unlockWithBiometrics(mockUserId)).rejects.toThrow(
        "Failed to unlock with biometrics",
      );
    });

    it("sets unlock side effects after successful unlock", async () => {
      biometricsService.unlockWithBiometricsForUser.mockResolvedValue(biometricsUserKey);
      await service.unlockWithBiometrics(mockUserId);

      expect(biometricsService.setBiometricProtectedUnlockKeyForUser).toHaveBeenCalledWith(
        mockUserId,
        mockUserKey,
      );
      expect(autoUnlockService.setAutoUnlockKey).toHaveBeenCalledWith(mockUserId, mockUserKey);
      expect(stateProvider.setUserState).toHaveBeenCalledWith(
        USER_EVER_HAD_USER_KEY,
        true,
        mockUserId,
      );
    });
  });

  describe("unlockWithKeyConnector", () => {
    const mockKeyConnectorUnlockData = {
      url: "https://key-connector.example.com",
      keyConnectorKeyWrappedUserKey: "mockKeyConnectorWrappedUserKey" as EncString,
    };

    it("unlocks the SDK client with the key connector method", async () => {
      await service.unlockWithKeyConnector(mockUserId, mockKeyConnectorUnlockData);

      expect(sdkService.unlock).toHaveBeenCalledWith(mockUserId, {
        userId: mockUserId,
        accountCryptographicState: mockAccountCryptographicState,
        method: {
          keyConnectorUrl: {
            url: mockKeyConnectorUnlockData.url,
            key_connector_key_wrapped_user_key:
              mockKeyConnectorUnlockData.keyConnectorKeyWrappedUserKey,
          },
        },
      });
    });
  });

  describe("SDK client", () => {
    it("unlocks the client with the request built without email, KDF, or upgrade token", async () => {
      await service.unlockWithPin(mockUserId, mockPin);

      expect(sdkService.unlock).toHaveBeenCalledWith(mockUserId, {
        userId: mockUserId,
        accountCryptographicState: mockAccountCryptographicState,
        method: { pinState: { pin: mockPin } },
      });
    });

    it("runs the unlock side effects with the user key the client unlocked with", async () => {
      const action = jest.fn().mockResolvedValue(undefined);
      service.registerOnUnlockAction(action);

      await service.unlockWithPin(mockUserId, mockPin);

      expect(autoUnlockService.setAutoUnlockKey).toHaveBeenCalledWith(mockUserId, mockUserKey);
      expect(keyService.buildSdkUnlockData).toHaveBeenCalledWith(mockUserId, mockUserKey);
      expect(action).toHaveBeenCalledWith(mockUserId, mockUserKey, UnlockMethod.Pin);
      expect(sdkService.lock).not.toHaveBeenCalled();
    });

    it("rethrows without side effects when the client cannot be unlocked", async () => {
      const error = new Error("wrong pin");
      sdkService.unlock.mockRejectedValue(error);
      const action = jest.fn().mockResolvedValue(undefined);
      service.registerOnUnlockAction(action);

      await expect(service.unlockWithPin(mockUserId, mockPin)).rejects.toBe(error);

      expect(autoUnlockService.setAutoUnlockKey).not.toHaveBeenCalled();
      expect(sdkService.setOrgKeys).not.toHaveBeenCalled();
      expect(stateProvider.setUserState).not.toHaveBeenCalled();
      expect(action).not.toHaveBeenCalled();
    });

    it("locks the client and rethrows when an unlock side effect fails", async () => {
      sdkService.lock.mockResolvedValue(undefined);
      const error = new Error("biometric key write failed");
      biometricsService.setBiometricProtectedUnlockKeyForUser.mockRejectedValue(error);

      await expect(service.unlockWithPin(mockUserId, mockPin)).rejects.toBe(error);

      expect(sdkService.lock).toHaveBeenCalledWith(mockUserId);
      expect(sdkService.setOrgKeys).not.toHaveBeenCalled();
    });

    it("locks the client and rethrows when applying the organization keys fails", async () => {
      sdkService.lock.mockResolvedValue(undefined);
      const error = new Error("org keys failed");
      sdkService.setOrgKeys.mockRejectedValue(error);

      await expect(service.unlockWithPin(mockUserId, mockPin)).rejects.toBe(error);

      expect(sdkService.lock).toHaveBeenCalledWith(mockUserId);
    });

    it("fails the unlock and locks the client when a lock lands before the organization keys apply", async () => {
      sdkService.lock.mockResolvedValue(undefined);
      // The lock cleared the client, so applying the organization keys leaves it not ready.
      sdkService.cryptoReady$.mockReturnValue(of(false));
      const action = jest.fn().mockResolvedValue(undefined);
      service.registerOnUnlockAction(action);
      const otherProcess = jest.spyOn(service as any, "runUnlockActionInOtherProcess");

      await expect(service.unlockWithPin(mockUserId, mockPin)).rejects.toThrow(
        "was locked during unlock",
      );

      expect(sdkService.setOrgKeys).toHaveBeenCalled();
      expect(sdkService.lock).toHaveBeenCalledWith(mockUserId);
      expect(action).not.toHaveBeenCalled();
      expect(otherProcess).not.toHaveBeenCalled();
    });

    it("leaves the client unlocked and rethrows when an unlock action fails", async () => {
      const error = new Error("unlock action failed");
      service.registerOnUnlockAction(jest.fn().mockRejectedValue(error));

      await expect(service.unlockWithPin(mockUserId, mockPin)).rejects.toBe(error);

      expect(sdkService.setOrgKeys).toHaveBeenCalled();
      expect(sdkService.lock).not.toHaveBeenCalled();
    });
  });

  describe("organization key push", () => {
    const orgKeys = { ["org-id" as OrganizationId]: "2.org-key" as UnsignedSharedKey };

    it("builds the unlock data from the unlocked user key and pushes its organization keys", async () => {
      keyService.buildSdkUnlockData.mockResolvedValue({ request: {} as any, orgKeys });

      await service.unlockWithPin(mockUserId, mockPin);

      expect(keyService.buildSdkUnlockData).toHaveBeenCalledWith(mockUserId, mockUserKey);
      expect(sdkService.setOrgKeys).toHaveBeenCalledWith(mockUserId, orgKeys);
    });

    it("pushes the organization keys before the unlock actions run", async () => {
      keyService.buildSdkUnlockData.mockResolvedValue({ request: {} as any, orgKeys });
      const action = jest.fn().mockResolvedValue(undefined);
      service.registerOnUnlockAction(action);

      await service.unlockWithPin(mockUserId, mockPin);

      expect(autoUnlockService.setAutoUnlockKey.mock.invocationCallOrder[0]).toBeLessThan(
        sdkService.setOrgKeys.mock.invocationCallOrder[0],
      );
      expect(sdkService.setOrgKeys.mock.invocationCallOrder[0]).toBeLessThan(
        action.mock.invocationCallOrder[0],
      );
    });

    it("warns and pushes empty organization keys when the unlock data is unavailable", async () => {
      keyService.buildSdkUnlockData.mockResolvedValue(null);

      await service.unlockWithPin(mockUserId, mockPin);

      expect(logService.warning).toHaveBeenCalled();
      expect(sdkService.setOrgKeys).toHaveBeenCalledWith(mockUserId, {});
    });

    it("logs, pushes empty organization keys, and completes the unlock when building the unlock data throws", async () => {
      keyService.buildSdkUnlockData.mockRejectedValue(new Error("private key decryption failed"));
      const action = jest.fn().mockResolvedValue(undefined);
      service.registerOnUnlockAction(action);

      await service.unlockWithPin(mockUserId, mockPin);

      expect(logService.error).toHaveBeenCalled();
      expect(sdkService.setOrgKeys).toHaveBeenCalledWith(mockUserId, {});
      expect(stateProvider.setUserState).toHaveBeenCalledWith(
        USER_EVER_HAD_USER_KEY,
        true,
        mockUserId,
      );
      expect(action).toHaveBeenCalled();
    });
  });

  describe("runOnUnlockActions", () => {
    it("runs the registered actions when the service performs an unlock", async () => {
      const action = jest.fn().mockResolvedValue(undefined);
      service.registerOnUnlockAction(action);

      await service.unlockWithPin(mockUserId, mockPin);

      expect(action).toHaveBeenCalledWith(mockUserId, mockUserKey, UnlockMethod.Pin);
    });

    it("emits on unlocked$ for both", async () => {
      const emissions: unknown[] = [];
      service.unlocked$.subscribe((e) => emissions.push(e));

      await service.unlockWithPin(mockUserId, mockPin);
      await service.runOnUnlockActions(
        mockUserId,
        new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey,
        UnlockMethod.SharedUnlock,
      );

      expect(emissions).toEqual([
        { userId: mockUserId, method: UnlockMethod.Pin },
        { userId: mockUserId, method: UnlockMethod.SharedUnlock },
      ]);
    });

    it("runs the registered actions for an unlock performed elsewhere", async () => {
      const userKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;
      const action = jest.fn().mockResolvedValue(undefined);
      service.registerOnUnlockAction(action);

      await service.runOnUnlockActions(mockUserId, userKey, UnlockMethod.Pin);

      expect(action).toHaveBeenCalledWith(mockUserId, userKey, UnlockMethod.Pin);
      expect(sdkService.unlock).not.toHaveBeenCalled();
    });
  });

  describe("unlockWithAutoUnlockKey", () => {
    const mockAutoUnlockKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;

    it("does nothing when the userId is null", async () => {
      const result = await service.unlockWithAutoUnlockKey(null as unknown as UserId);

      expect(result).toBe(false);
      expect(autoUnlockService.getAutoUnlockKey).not.toHaveBeenCalled();
      expect(sdkService.unlock).not.toHaveBeenCalled();
    });

    it("does nothing when no never-lock key is stored", async () => {
      autoUnlockService.getAutoUnlockKey.mockResolvedValue(null);

      const result = await service.unlockWithAutoUnlockKey(mockUserId);

      expect(result).toBe(false);
      expect(autoUnlockService.getAutoUnlockKey).toHaveBeenCalledWith(mockUserId);
      expect(sdkService.unlock).not.toHaveBeenCalled();
    });

    it("unlocks with the stored never-lock key", async () => {
      autoUnlockService.getAutoUnlockKey.mockResolvedValue(mockAutoUnlockKey);

      const result = await service.unlockWithAutoUnlockKey(mockUserId);

      expect(result).toBe(true);
      expect(sdkService.unlock).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          method: { decryptedKey: { decrypted_user_key: mockAutoUnlockKey.toSdk() } },
        }),
      );
    });
  });
});
