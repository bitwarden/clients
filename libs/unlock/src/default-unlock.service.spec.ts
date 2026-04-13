// Polyfill for Symbol.dispose required by the service's use of `using` keyword
import "core-js/proposals/explicit-resource-management";

import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MASTER_KEY } from "@bitwarden/common/key-management/master-password/services/master-password.service";
import { PinStateServiceAbstraction } from "@bitwarden/common/key-management/pin/pin-state.service.abstraction";
import { VaultTimeoutStringType } from "@bitwarden/common/key-management/vault-timeout";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { USER_EVER_HAD_USER_KEY } from "@bitwarden/common/platform/services/key-state/user-key.state";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import {
  BiometricsService,
  BiometricStateService,
  KdfConfigService,
} from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { PureCrypto } from "@bitwarden/sdk-internal";
import { StateProvider, StateService } from "@bitwarden/state";

import { DefaultUnlockService } from "./default-unlock.service";

const mockUserId = "b1e2d3c4-a1b2-c3d4-e5f6-a1b2c3d4e5f6" as UserId;
const mockEmail = "test@example.com";
const mockPin = "1234";
const mockMasterPassword = "master-password";
const mockKdfParams = { type: "pbkdf2" } as any;
const mockAccountCryptographicState = { some: "state" } as any;
const mockPinProtectedUserKeyEnvelope = { some: "envelope" } as any;
const mockMasterPasswordUnlockData = { some: "unlockData", salt: "salt", kdf: "pbkdf2" } as any;

describe("DefaultUnlockService", () => {
  const registerSdkService = mock<RegisterSdkService>();
  const accountCryptographicStateService = mock<AccountCryptographicStateService>();
  const pinStateService = mock<PinStateServiceAbstraction>();
  const kdfService = mock<KdfConfigService>();
  const accountService = mock<AccountService>();
  const masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
  const stateProvider = mock<StateProvider>();
  const stateService = mock<StateService>();
  const logService = mock<LogService>();
  const biometricsService = mock<BiometricsService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const biometricStateService = mock<BiometricStateService>();

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
    pinStateService.getPinLockType.mockResolvedValue("PERSISTENT" as any);
    pinStateService.getPinProtectedUserKeyEnvelope.mockResolvedValue(
      mockPinProtectedUserKeyEnvelope,
    );
    masterPasswordService.masterPasswordUnlockData$.mockReturnValue(
      of({ toSdk: () => mockMasterPasswordUnlockData } as any),
    );
    stateProvider.getUserState$.mockReturnValue(of(VaultTimeoutStringType.Never));
    stateService.setUserKeyAutoUnlock.mockResolvedValue(undefined);
    biometricsService.setBiometricProtectedUnlockKeyForUser.mockResolvedValue(undefined);
    biometricStateService.biometricUnlockEnabled$.mockReturnValue(of(true));
    platformUtilsService.getClientType.mockReturnValue(ClientType.Browser);

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
      pinStateService,
      kdfService,
      accountService,
      masterPasswordService,
      stateProvider,
      logService,
      biometricsService,
      platformUtilsService,
      stateService,
      biometricStateService,
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
          pinEnvelope: {
            pin: mockPin,
            pin_protected_user_key_envelope: mockPinProtectedUserKeyEnvelope,
          },
        },
      });
    });

    it("throws when SDK is not available", async () => {
      registerSdkService.registerClient$.mockReturnValue(of(null as any));

      await expect(service.unlockWithPin(mockUserId, mockPin)).rejects.toThrow("SDK not available");
    });

    it("fetches PERSISTENT pin envelope when the pin lock type is persistent", async () => {
      pinStateService.getPinLockType.mockResolvedValue("PERSISTENT" as any);
      await service.unlockWithPin(mockUserId, mockPin);
      expect(pinStateService.getPinProtectedUserKeyEnvelope).toHaveBeenCalledWith(
        mockUserId,
        "PERSISTENT",
      );
    });

    it("fetches EPHEMERAL pin envelope when the pin lock type is ephemeral", async () => {
      pinStateService.getPinLockType.mockResolvedValue("EPHEMERAL" as any);
      await service.unlockWithPin(mockUserId, mockPin);
      expect(pinStateService.getPinProtectedUserKeyEnvelope).toHaveBeenCalledWith(
        mockUserId,
        "EPHEMERAL",
      );
    });

    it("sets unlock side effects after successful unlock", async () => {
      const userEncryptionKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray);
      mockCrypto.get_user_encryption_key.mockResolvedValue(userEncryptionKey.toBase64());

      await service.unlockWithPin(mockUserId, mockPin);

      expect(biometricsService.setBiometricProtectedUnlockKeyForUser).toHaveBeenCalledWith(
        mockUserId,
        expect.any(SymmetricCryptoKey),
      );
      expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(userEncryptionKey.toBase64(), {
        userId: mockUserId,
      });
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
      expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(userEncryptionKey.toBase64(), {
        userId: mockUserId,
      });
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
      expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(userEncryptionKey.toBase64(), {
        userId: mockUserId,
      });
      expect(stateProvider.setUserState).toHaveBeenCalledWith(
        USER_EVER_HAD_USER_KEY,
        true,
        mockUserId,
      );
    });
  });

  describe("shouldStoreUserKeyAutoUnlock", () => {
    it("returns true for cli without checking vault timeout", async () => {
      platformUtilsService.getClientType.mockReturnValue(ClientType.Cli);

      const result = await (service as any).shouldStoreUserKeyAutoUnlock(mockUserId);

      expect(result).toBe(true);
      expect(stateProvider.getUserState$).not.toHaveBeenCalled();
    });

    it("returns true when vault timeout is Never", async () => {
      platformUtilsService.getClientType.mockReturnValue(ClientType.Browser);
      stateProvider.getUserState$.mockReturnValue(of(VaultTimeoutStringType.Never));

      const result = await (service as any).shouldStoreUserKeyAutoUnlock(mockUserId);

      expect(result).toBe(true);
      expect(stateProvider.getUserState$).toHaveBeenCalledWith(expect.anything(), mockUserId);
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
