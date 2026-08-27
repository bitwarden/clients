// Polyfill for Symbol.dispose required by the service's use of `using` keyword
import "core-js/proposals/explicit-resource-management";

import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MASTER_KEY } from "@bitwarden/common/key-management/master-password/services/master-password.service";
import { V2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { USER_EVER_HAD_USER_KEY } from "@bitwarden/common/platform/services/key-state/user-key.state";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import {
  BiometricsService,
  BiometricStateService,
  KdfConfigService,
} from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { CsprngArray, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { EncString, PureCrypto, V2UpgradeToken } from "@bitwarden/sdk-internal";
import { StateProvider } from "@bitwarden/state";

import { AutoUnlockService } from "./auto-unlock.service";
import { DefaultUnlockService } from "./default-unlock.service";
import { UnlockMethod } from "./unlock-method.enum";

const mockUserId = "b1e2d3c4-a1b2-c3d4-e5f6-a1b2c3d4e5f6" as UserId;
const mockEmail = "test@example.com";
const mockPin = "1234";
const mockMasterPassword = "master-password";
const mockKdfParams = { type: "pbkdf2" } as any;
const mockAccountCryptographicState = { some: "state" } as any;
const mockMasterPasswordUnlockData = { some: "unlockData", salt: "salt", kdf: "pbkdf2" } as any;
const mockV2UpgradeToken: V2UpgradeToken = {
  wrapped_user_key_1: "mockWrappedV1Key" as EncString,
  wrapped_user_key_2: "mockWrappedV2Key" as EncString,
};

describe("DefaultUnlockService", () => {
  const registerSdkService = mock<RegisterSdkService>();
  const accountCryptographicStateService = mock<AccountCryptographicStateService>();
  const kdfService = mock<KdfConfigService>();
  const accountService = mock<AccountService>();
  const masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
  const stateProvider = mock<StateProvider>();
  const logService = mock<LogService>();
  const biometricsService = mock<BiometricsService>();
  const biometricStateService = mock<BiometricStateService>();
  const v2UpgradeTokenStateService = mock<V2UpgradeTokenStateService>();
  const autoUnlockService = mock<AutoUnlockService>();

  let service: DefaultUnlockService;
  let mockSdkRef: any;
  let mockSdk: any;
  let mockCrypto: any;
  let setLegacyMasterKeyFromUnlockDataSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();

    mockCrypto = {
      initialize_user_crypto: jest.fn().mockResolvedValue(undefined),
      get_user_encryption_key: jest
        .fn()
        .mockResolvedValue(new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray).toBase64()),
    };

    mockSdkRef = {
      value: {
        crypto: jest.fn().mockReturnValue(mockCrypto),
      },
      [Symbol.dispose]: jest.fn(),
    };

    mockSdk = {
      take: jest.fn().mockReturnValue(mockSdkRef),
    };

    registerSdkService.registerClient$.mockReturnValue(of(mockSdk));
    accountCryptographicStateService.accountCryptographicState$.mockReturnValue(
      of(mockAccountCryptographicState),
    );
    kdfService.getKdfConfig$.mockReturnValue(of({ toSdkConfig: () => mockKdfParams } as any));
    accountService.accounts$ = of({
      [mockUserId]: { email: mockEmail },
    } as any);
    masterPasswordService.masterPasswordUnlockData$.mockReturnValue(
      of({ toSdk: () => mockMasterPasswordUnlockData } as any),
    );
    autoUnlockService.setAutoUnlockKey.mockResolvedValue(undefined);
    biometricsService.setBiometricProtectedUnlockKeyForUser.mockResolvedValue(undefined);
    biometricStateService.biometricUnlockEnabled$.mockReturnValue(of(true));
    v2UpgradeTokenStateService.v2UpgradeToken$.mockReturnValue(of(null));

    Object.defineProperty(SdkLoadService, "Ready", {
      value: Promise.resolve(),
      writable: true,
      configurable: true,
    });

    jest.spyOn(PureCrypto, "derive_kdf_material").mockReturnValue(new Uint8Array(32));

    const mockStateUpdate = jest.fn().mockResolvedValue(undefined);
    stateProvider.getUser.mockReturnValue({ update: mockStateUpdate } as any);
    stateProvider.setUserState.mockResolvedValue(undefined);

    service = new DefaultUnlockService(
      registerSdkService,
      accountCryptographicStateService,
      kdfService,
      accountService,
      masterPasswordService,
      stateProvider,
      logService,
      biometricsService,
      biometricStateService,
      v2UpgradeTokenStateService,
      autoUnlockService,
    );

    setLegacyMasterKeyFromUnlockDataSpy = jest
      .spyOn(service as any, "setLegacyMasterKeyFromUnlockData")
      .mockResolvedValue(undefined);
  });

  describe("unlockWithPin", () => {
    it("calls SDK initialize_user_crypto with correct pin method", async () => {
      await service.unlockWithPin(mockUserId, mockPin);

      expect(mockCrypto.initialize_user_crypto).toHaveBeenCalledWith({
        userId: mockUserId,
        kdfParams: mockKdfParams,
        email: mockEmail,
        accountCryptographicState: mockAccountCryptographicState,
        method: {
          pinState: {
            pin: mockPin,
          },
        },
      });
    });

    it("forwards the persisted V2 upgrade token to initialize_user_crypto", async () => {
      v2UpgradeTokenStateService.v2UpgradeToken$.mockReturnValue(of(mockV2UpgradeToken));

      await service.unlockWithPin(mockUserId, mockPin);

      expect(v2UpgradeTokenStateService.v2UpgradeToken$).toHaveBeenCalledWith(mockUserId);
      expect(mockCrypto.initialize_user_crypto).toHaveBeenCalledWith(
        expect.objectContaining({ upgradeToken: mockV2UpgradeToken }),
      );
    });

    it("throws when SDK is not available", async () => {
      registerSdkService.registerClient$.mockReturnValue(of(null as any));

      await expect(service.unlockWithPin(mockUserId, mockPin)).rejects.toThrow("SDK not available");
    });

    it("sets unlock side effects after successful unlock", async () => {
      const userEncryptionKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray);
      mockCrypto.get_user_encryption_key.mockResolvedValue(userEncryptionKey.toBase64());

      await service.unlockWithPin(mockUserId, mockPin);

      expect(biometricsService.setBiometricProtectedUnlockKeyForUser).toHaveBeenCalledWith(
        mockUserId,
        expect.any(SymmetricCryptoKey),
      );
      expect(autoUnlockService.setAutoUnlockKey).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ keyB64: userEncryptionKey.toBase64() }),
      );
      expect(stateProvider.setUserState).toHaveBeenCalledWith(
        USER_EVER_HAD_USER_KEY,
        true,
        mockUserId,
      );
    });
  });

  describe("unlockWithMasterPassword", () => {
    it("calls SDK initialize_user_crypto with correct master password method", async () => {
      await service.unlockWithMasterPassword(mockUserId, mockMasterPassword);

      expect(mockCrypto.initialize_user_crypto).toHaveBeenCalledWith({
        userId: mockUserId,
        kdfParams: mockKdfParams,
        email: mockEmail,
        accountCryptographicState: mockAccountCryptographicState,
        method: {
          masterPasswordUnlock: {
            password: mockMasterPassword,
            master_password_unlock: mockMasterPasswordUnlockData,
          },
        },
      });
    });

    it("forwards the persisted V2 upgrade token to initialize_user_crypto", async () => {
      v2UpgradeTokenStateService.v2UpgradeToken$.mockReturnValue(of(mockV2UpgradeToken));

      await service.unlockWithMasterPassword(mockUserId, mockMasterPassword);

      expect(v2UpgradeTokenStateService.v2UpgradeToken$).toHaveBeenCalledWith(mockUserId);
      expect(mockCrypto.initialize_user_crypto).toHaveBeenCalledWith(
        expect.objectContaining({ upgradeToken: mockV2UpgradeToken }),
      );
    });

    it("throws when SDK is not available", async () => {
      registerSdkService.registerClient$.mockReturnValue(of(null as any));

      await expect(
        service.unlockWithMasterPassword(mockUserId, mockMasterPassword),
      ).rejects.toThrow("SDK not available");
    });

    it("sets unlock side effects after successful unlock", async () => {
      const userEncryptionKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray);
      mockCrypto.get_user_encryption_key.mockResolvedValue(userEncryptionKey.toBase64());

      await service.unlockWithMasterPassword(mockUserId, mockMasterPassword);

      expect(biometricsService.setBiometricProtectedUnlockKeyForUser).toHaveBeenCalledWith(
        mockUserId,
        expect.any(SymmetricCryptoKey),
      );
      expect(autoUnlockService.setAutoUnlockKey).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ keyB64: userEncryptionKey.toBase64() }),
      );
      expect(stateProvider.setUserState).toHaveBeenCalledWith(
        USER_EVER_HAD_USER_KEY,
        true,
        mockUserId,
      );
    });
  });

  describe("unlockWithBiometrics", () => {
    const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;

    it("calls SDK initialize_user_crypto with decrypted key from biometrics", async () => {
      biometricsService.unlockWithBiometricsForUser.mockResolvedValue(mockUserKey);

      await service.unlockWithBiometrics(mockUserId);

      expect(biometricsService.unlockWithBiometricsForUser).toHaveBeenCalledWith(mockUserId);
      expect(mockCrypto.initialize_user_crypto).toHaveBeenCalledWith({
        userId: mockUserId,
        kdfParams: mockKdfParams,
        email: mockEmail,
        accountCryptographicState: mockAccountCryptographicState,
        method: {
          decryptedKey: {
            decrypted_user_key: mockUserKey.toBase64(),
          },
        },
      });
    });

    it("forwards the persisted V2 upgrade token to initialize_user_crypto", async () => {
      biometricsService.unlockWithBiometricsForUser.mockResolvedValue(mockUserKey);
      v2UpgradeTokenStateService.v2UpgradeToken$.mockReturnValue(of(mockV2UpgradeToken));

      await service.unlockWithBiometrics(mockUserId);

      expect(v2UpgradeTokenStateService.v2UpgradeToken$).toHaveBeenCalledWith(mockUserId);
      expect(mockCrypto.initialize_user_crypto).toHaveBeenCalledWith(
        expect.objectContaining({ upgradeToken: mockV2UpgradeToken }),
      );
    });

    it("throws when biometrics returns null", async () => {
      biometricsService.unlockWithBiometricsForUser.mockResolvedValue(null);

      await expect(service.unlockWithBiometrics(mockUserId)).rejects.toThrow(
        "Failed to unlock with biometrics",
      );
    });

    it("throws when SDK is not available", async () => {
      biometricsService.unlockWithBiometricsForUser.mockResolvedValue(mockUserKey);
      registerSdkService.registerClient$.mockReturnValue(of(null as any));

      await expect(service.unlockWithBiometrics(mockUserId)).rejects.toThrow("SDK not available");
    });

    it("sets unlock side effects after successful unlock", async () => {
      biometricsService.unlockWithBiometricsForUser.mockResolvedValue(mockUserKey);
      const userEncryptionKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray);
      mockCrypto.get_user_encryption_key.mockResolvedValue(userEncryptionKey.toBase64());

      await service.unlockWithBiometrics(mockUserId);

      expect(biometricsService.setBiometricProtectedUnlockKeyForUser).toHaveBeenCalledWith(
        mockUserId,
        expect.any(SymmetricCryptoKey),
      );
      expect(autoUnlockService.setAutoUnlockKey).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ keyB64: userEncryptionKey.toBase64() }),
      );
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

    it("calls SDK initialize_user_crypto with the key connector method", async () => {
      await service.unlockWithKeyConnector(mockUserId, mockKeyConnectorUnlockData);

      expect(mockCrypto.initialize_user_crypto).toHaveBeenCalledWith({
        userId: mockUserId,
        kdfParams: mockKdfParams,
        email: mockEmail,
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

    it("forwards the persisted V2 upgrade token to initialize_user_crypto", async () => {
      v2UpgradeTokenStateService.v2UpgradeToken$.mockReturnValue(of(mockV2UpgradeToken));

      await service.unlockWithKeyConnector(mockUserId, mockKeyConnectorUnlockData);

      expect(v2UpgradeTokenStateService.v2UpgradeToken$).toHaveBeenCalledWith(mockUserId);
      expect(mockCrypto.initialize_user_crypto).toHaveBeenCalledWith(
        expect.objectContaining({ upgradeToken: mockV2UpgradeToken }),
      );
    });

    it("throws when SDK is not available", async () => {
      registerSdkService.registerClient$.mockReturnValue(of(null as any));

      await expect(
        service.unlockWithKeyConnector(mockUserId, mockKeyConnectorUnlockData),
      ).rejects.toThrow("SDK not available");
    });
  });

  describe("runOnUnlockActions", () => {
    it("runs the registered actions when the service performs an unlock", async () => {
      const userEncryptionKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray);
      mockCrypto.get_user_encryption_key.mockResolvedValue(userEncryptionKey.toBase64());
      const action = jest.fn().mockResolvedValue(undefined);
      service.registerOnUnlockAction(action);

      await service.unlockWithPin(mockUserId, mockPin);

      expect(action).toHaveBeenCalledWith(
        mockUserId,
        expect.any(SymmetricCryptoKey),
        UnlockMethod.Pin,
      );
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
      expect(mockCrypto.initialize_user_crypto).not.toHaveBeenCalled();
    });
  });

  describe("unlockWithAutoUnlockKey", () => {
    const mockAutoUnlockKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;

    it("does nothing when the userId is null", async () => {
      const result = await service.unlockWithAutoUnlockKey(null as unknown as UserId);

      expect(result).toBe(false);
      expect(autoUnlockService.getAutoUnlockKey).not.toHaveBeenCalled();
      expect(mockCrypto.initialize_user_crypto).not.toHaveBeenCalled();
    });

    it("does nothing when no never-lock key is stored", async () => {
      autoUnlockService.getAutoUnlockKey.mockResolvedValue(null);

      const result = await service.unlockWithAutoUnlockKey(mockUserId);

      expect(result).toBe(false);
      expect(autoUnlockService.getAutoUnlockKey).toHaveBeenCalledWith(mockUserId);
      expect(mockCrypto.initialize_user_crypto).not.toHaveBeenCalled();
    });

    it("unlocks with the stored never-lock key", async () => {
      autoUnlockService.getAutoUnlockKey.mockResolvedValue(mockAutoUnlockKey);

      const result = await service.unlockWithAutoUnlockKey(mockUserId);

      expect(result).toBe(true);
      expect(mockCrypto.initialize_user_crypto).toHaveBeenCalledWith(
        expect.objectContaining({
          method: { decryptedKey: { decrypted_user_key: mockAutoUnlockKey.toSdk() } },
        }),
      );
    });
  });

  describe("setLegacyMasterKeyFromUnlockData", () => {
    it("derives legacy master key and stores key", async () => {
      setLegacyMasterKeyFromUnlockDataSpy.mockRestore();
      const derivedMasterKey = new Uint8Array(32);
      const updateMasterKey = jest.fn().mockResolvedValue(undefined);

      jest.spyOn(PureCrypto, "derive_kdf_material").mockReturnValue(derivedMasterKey);
      stateProvider.getUser.mockReturnValueOnce({ update: updateMasterKey } as any);

      await (service as any).setLegacyMasterKeyFromUnlockData(
        mockMasterPassword,
        mockMasterPasswordUnlockData,
        mockUserId,
      );

      expect(PureCrypto.derive_kdf_material).toHaveBeenCalledWith(
        new TextEncoder().encode(mockMasterPassword),
        new TextEncoder().encode(mockMasterPasswordUnlockData.salt),
        mockMasterPasswordUnlockData.kdf,
      );
      expect(stateProvider.getUser).toHaveBeenCalledWith(mockUserId, MASTER_KEY);
      expect(updateMasterKey).toHaveBeenCalledTimes(1);
    });
  });
});
