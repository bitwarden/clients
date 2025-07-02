import { mock } from "jest-mock-extended";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { passwords } from "@bitwarden/desktop-napi";
import { BiometricsStatus, BiometricStateService } from "@bitwarden/key-management";

import { WindowMain } from "../../main/window.main";

import OsBiometricsServiceWindows from "./os-biometrics-windows.service";

jest.mock("@bitwarden/desktop-napi", () => ({
  biometrics: {
    available: jest.fn(),
    setBiometricSecret: jest.fn(),
    getBiometricSecret: jest.fn(),
    deleteBiometricSecret: jest.fn(),
    prompt: jest.fn(),
    deriveKeyMaterial: jest.fn(),
  },
  passwords: {
    getPassword: jest.fn(),
    deletePassword: jest.fn(),
    isAvailable: jest.fn(),
    PASSWORD_NOT_FOUND: "Password not found",
  },
}));

describe("OsBiometricsServiceWindows", () => {
  let service: OsBiometricsServiceWindows;
  let i18nService: I18nService;
  let windowMain: WindowMain;
  let logService: LogService;
  let biometricStateService: BiometricStateService;

  const mockUserId = "test-user-id" as UserId;

  beforeEach(() => {
    i18nService = mock<I18nService>();
    windowMain = mock<WindowMain>();
    logService = mock<LogService>();
    biometricStateService = mock<BiometricStateService>();
    const encryptionService = mock<EncryptService>();
    const cryptoFunctionService = mock<CryptoFunctionService>();
    service = new OsBiometricsServiceWindows(
      i18nService,
      windowMain,
      logService,
      biometricStateService,
      encryptionService,
      cryptoFunctionService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getBiometricsFirstUnlockStatusForUser", () => {
    const userId = "test-user-id" as UserId;
    it("should return Available when requirePasswordOnRestart is false", async () => {
      biometricStateService.getRequirePasswordOnStart = jest.fn().mockResolvedValue(false);
      const result = await service.getBiometricsFirstUnlockStatusForUser(userId);
      expect(result).toBe(BiometricsStatus.Available);
    });
    it("should return Available when requirePasswordOnRestart is true and client key half is set", async () => {
      biometricStateService.getRequirePasswordOnStart = jest.fn().mockResolvedValue(true);
      (service as any).clientKeyHalves = new Map<string, Uint8Array>();
      (service as any).clientKeyHalves.set(userId, new Uint8Array([1, 2, 3, 4]));
      const result = await service.getBiometricsFirstUnlockStatusForUser(userId);
      expect(result).toBe(BiometricsStatus.Available);
    });
    it("should return UnlockNeeded when requirePasswordOnRestart is true and client key half is not set", async () => {
      biometricStateService.getRequirePasswordOnStart = jest.fn().mockResolvedValue(true);
      (service as any).clientKeyHalves = new Map<string, Uint8Array>();
      const result = await service.getBiometricsFirstUnlockStatusForUser(userId);
      expect(result).toBe(BiometricsStatus.UnlockNeeded);
    });
  });

  describe("getOrCreateBiometricEncryptionClientKeyHalf", () => {
    const userId = "test-user-id" as UserId;
    const key = new SymmetricCryptoKey(new Uint8Array(64));
    let encryptionService: EncryptService;
    let cryptoFunctionService: CryptoFunctionService;

    beforeEach(() => {
      encryptionService = mock<EncryptService>();
      cryptoFunctionService = mock<CryptoFunctionService>();
      service = new OsBiometricsServiceWindows(
        mock<I18nService>(),
        windowMain,
        mock<LogService>(),
        biometricStateService,
        encryptionService,
        cryptoFunctionService,
      );
    });

    it("should return null if getRequirePasswordOnRestart is false", async () => {
      biometricStateService.getRequirePasswordOnStart = jest.fn().mockResolvedValue(false);
      const result = await service.getOrCreateBiometricEncryptionClientKeyHalf(userId, key);
      expect(result).toBeNull();
    });

    it("should return cached key half if already present", async () => {
      biometricStateService.getRequirePasswordOnStart = jest.fn().mockResolvedValue(true);
      const cachedKeyHalf = new Uint8Array([10, 20, 30]);
      (service as any).clientKeyHalves.set(userId.toString(), cachedKeyHalf);
      const result = await service.getOrCreateBiometricEncryptionClientKeyHalf(userId, key);
      expect(result).toBe(cachedKeyHalf);
    });

    it("should decrypt and return existing encrypted client key half", async () => {
      biometricStateService.getRequirePasswordOnStart = jest.fn().mockResolvedValue(true);
      biometricStateService.getEncryptedClientKeyHalf = jest
        .fn()
        .mockResolvedValue(new Uint8Array([1, 2, 3]));
      const decrypted = new Uint8Array([4, 5, 6]);
      encryptionService.decryptBytes = jest.fn().mockResolvedValue(decrypted);

      const result = await service.getOrCreateBiometricEncryptionClientKeyHalf(userId, key);

      expect(biometricStateService.getEncryptedClientKeyHalf).toHaveBeenCalledWith(userId);
      expect(encryptionService.decryptBytes).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), key);
      expect(result).toEqual(decrypted);
      expect((service as any).clientKeyHalves.get(userId.toString())).toEqual(decrypted);
    });

    it("should generate, encrypt, store, and cache a new key half if none exists", async () => {
      biometricStateService.getRequirePasswordOnStart = jest.fn().mockResolvedValue(true);
      biometricStateService.getEncryptedClientKeyHalf = jest.fn().mockResolvedValue(null);
      const randomBytes = new Uint8Array([7, 8, 9]);
      cryptoFunctionService.randomBytes = jest.fn().mockResolvedValue(randomBytes);
      const encrypted = new Uint8Array([10, 11, 12]);
      encryptionService.encryptBytes = jest.fn().mockResolvedValue(encrypted);
      biometricStateService.setEncryptedClientKeyHalf = jest.fn().mockResolvedValue(undefined);

      const result = await service.getOrCreateBiometricEncryptionClientKeyHalf(userId, key);

      expect(cryptoFunctionService.randomBytes).toHaveBeenCalledWith(32);
      expect(encryptionService.encryptBytes).toHaveBeenCalledWith(randomBytes, key);
      expect(biometricStateService.setEncryptedClientKeyHalf).toHaveBeenCalledWith(
        encrypted,
        userId,
      );
      expect(result).toBeNull();
      expect((service as any).clientKeyHalves.get(userId.toString())).toBeNull();
    });
  });

  describe("deleteBiometricKey", () => {
    const serviceName = "Bitwarden_biometric";
    const keyName = "test-user-id_user_biometric";
    const witnessKeyName = "test-user-id_user_biometric_witness";

    it("should delete biometric key successfully", async () => {
      await service.deleteBiometricKey(mockUserId);

      expect(passwords.deletePassword).toHaveBeenCalledWith(serviceName, keyName);
      expect(passwords.deletePassword).toHaveBeenCalledWith(serviceName, witnessKeyName);
    });

    it.each([
      [false, false],
      [false, true],
      [true, false],
    ])(
      "should not throw error if key found: %s and witness key found: %s",
      async (keyFound, witnessKeyFound) => {
        passwords.deletePassword = jest.fn().mockImplementation((_, account) => {
          if (account === keyName) {
            if (!keyFound) {
              throw new Error(passwords.PASSWORD_NOT_FOUND);
            }
            return Promise.resolve();
          }
          if (account === witnessKeyName) {
            if (!witnessKeyFound) {
              throw new Error(passwords.PASSWORD_NOT_FOUND);
            }
            return Promise.resolve();
          }
          throw new Error("Unexpected key");
        });

        await service.deleteBiometricKey(mockUserId);

        expect(passwords.deletePassword).toHaveBeenCalledWith(serviceName, keyName);
        expect(passwords.deletePassword).toHaveBeenCalledWith(serviceName, witnessKeyName);
        if (!keyFound) {
          expect(logService.debug).toHaveBeenCalledWith(
            "[OsBiometricService] Biometric key %s not found for service %s.",
            keyName,
            serviceName,
          );
        }
        if (!witnessKeyFound) {
          expect(logService.debug).toHaveBeenCalledWith(
            "[OsBiometricService] Biometric witness key %s not found for service %s.",
            witnessKeyName,
            serviceName,
          );
        }
      },
    );

    it("should throw error when deletePassword for key throws unexpected errors", async () => {
      const error = new Error("Unexpected error");
      passwords.deletePassword = jest.fn().mockImplementation((_, account) => {
        if (account === keyName) {
          throw error;
        }
        if (account === witnessKeyName) {
          return Promise.resolve();
        }
        throw new Error("Unexpected key");
      });

      await expect(service.deleteBiometricKey(mockUserId)).rejects.toThrow(error);

      expect(passwords.deletePassword).toHaveBeenCalledWith(serviceName, keyName);
      expect(passwords.deletePassword).not.toHaveBeenCalledWith(serviceName, witnessKeyName);
    });

    it("should throw error when deletePassword for witness key throws unexpected errors", async () => {
      const error = new Error("Unexpected error");
      passwords.deletePassword = jest.fn().mockImplementation((_, account) => {
        if (account === keyName) {
          return Promise.resolve();
        }
        if (account === witnessKeyName) {
          throw error;
        }
        throw new Error("Unexpected key");
      });

      await expect(service.deleteBiometricKey(mockUserId)).rejects.toThrow(error);

      expect(passwords.deletePassword).toHaveBeenCalledWith(serviceName, keyName);
      expect(passwords.deletePassword).toHaveBeenCalledWith(serviceName, witnessKeyName);
    });
  });
});
