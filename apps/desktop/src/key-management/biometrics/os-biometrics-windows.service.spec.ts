import { randomBytes } from "node:crypto";

import { BrowserWindow } from "electron";
import { mock } from "jest-mock-extended";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { biometrics, passwords } from "@bitwarden/desktop-napi";
import { BiometricsStatus, BiometricStateService } from "@bitwarden/key-management";

import { WindowMain } from "../../main/window.main";

import OsBiometricsServiceWindows from "./os-biometrics-windows.service";

jest.mock("@bitwarden/desktop-napi", () => {
  return {
    biometrics: {
      available: jest.fn().mockResolvedValue(true),
      getBiometricSecret: jest.fn().mockResolvedValue(""),
      setBiometricSecret: jest.fn().mockResolvedValue(""),
      deriveKeyMaterial: jest.fn().mockResolvedValue({
        keyB64: "",
        ivB64: "",
      }),
      prompt: jest.fn().mockResolvedValue(true),
    },
    passwords: {
      getPassword: jest.fn().mockResolvedValue(null),
      deletePassword: jest.fn().mockImplementation(() => {}),
    },
  };
});

describe("OsBiometricsServiceWindows", function () {
  const i18nService = mock<I18nService>();
  const windowMain = mock<WindowMain>();
  const browserWindow = mock<BrowserWindow>();

  let service: OsBiometricsServiceWindows;
  let biometricStateService: BiometricStateService;

  const serviceKey = "testService";
  const storageKey = "testStorageKey";
  const clientKeyHalfB64 = "testClientKeyHalfB64";

  beforeEach(() => {
    windowMain.win = browserWindow;

    const logService = mock<LogService>();
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
        null,
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

  describe("supportsBiometrics", () => {
    it("should return true if biometrics are available", async () => {
      biometrics.available = jest.fn().mockResolvedValue(true);

      const result = await service.supportsBiometrics();

      expect(result).toBe(true);
    });

    it("should return false if biometrics are not available", async () => {
      biometrics.available = jest.fn().mockResolvedValue(false);

      const result = await service.supportsBiometrics();

      expect(result).toBe(false);
    });
  });

  describe("getBiometricKey", () => {
    beforeEach(() => {
      biometrics.prompt = jest.fn().mockResolvedValue(true);
    });

    it("should throw error when unsuccessfully authenticated biometrics", async () => {
      biometrics.prompt = jest.fn().mockResolvedValue(false);

      await expect(
        service.getBiometricKey(serviceKey, storageKey, clientKeyHalfB64),
      ).rejects.toThrow(new Error("Biometric authentication failed"));
    });

    it.each([null, undefined, ""])(
      "should return null if no password is found '%s'",
      async (password) => {
        passwords.getPassword = jest.fn().mockResolvedValue(password);

        const result = await service.getBiometricKey(serviceKey, storageKey, clientKeyHalfB64);

        expect(result).toBeNull();
        expect(passwords.getPassword).toHaveBeenCalledWith(serviceKey, storageKey);
      },
    );

    it("should return the biometricKey and setBiometricSecret called if password is not encrypted", async () => {
      const biometricKey = "biometricKey";
      passwords.getPassword = jest.fn().mockResolvedValue(biometricKey);
      service["_osKeyHalf"] = "testKeyB64";
      service["_iv"] = "testIvB64";

      const result = await service.getBiometricKey(serviceKey, storageKey, clientKeyHalfB64);

      expect(result).toBe(biometricKey);
      expect(passwords.getPassword).toHaveBeenCalledWith(serviceKey, storageKey);
      expect(biometrics.setBiometricSecret).toHaveBeenCalledWith(
        service,
        storageKey,
        biometricKey,
        {
          osKeyPartB64: "testKeyB64",
          clientKeyPartB64: clientKeyHalfB64,
        },
        "testIvB64",
      );
    });

    it("should return the biometricKey if password is encrypted", async () => {
      const biometricKey = "biometricKey";
      const biometricKeyEncrypted = "2.testId|data|mac";
      passwords.getPassword = jest.fn().mockResolvedValue(biometricKeyEncrypted);
      service["_osKeyHalf"] = "testKeyB64";
      service["_iv"] = "testIvB64";
      biometrics.getBiometricSecret = jest.fn().mockResolvedValue(biometricKey);

      const result = await service.getBiometricKey(serviceKey, storageKey, clientKeyHalfB64);

      expect(result).toBe(biometricKey);
      expect(passwords.getPassword).toHaveBeenCalledWith(serviceKey, storageKey);
      expect(biometrics.setBiometricSecret).not.toHaveBeenCalled();
    });
  });

  describe("deleteBiometricKey", () => {
    it("should delete the biometric key", async () => {
      await service.deleteBiometricKey(serviceKey, storageKey);

      expect(passwords.deletePassword).toHaveBeenCalledWith(serviceKey, storageKey);
    });
  });

  describe("authenticateBiometric", () => {
    const hwnd = randomBytes(32).buffer;
    const consentMessage = "Test Windows Hello Consent Message";

    beforeEach(() => {
      windowMain.win.getNativeWindowHandle = jest.fn().mockReturnValue(hwnd);
      i18nService.t.mockReturnValue(consentMessage);
    });

    it("should return true when biometric authentication is successful", async () => {
      const result = await service.authenticateBiometric();

      expect(result).toBe(true);
      expect(biometrics.prompt).toHaveBeenCalledWith(hwnd, consentMessage);
    });

    it("should return false when biometric authentication fails", async () => {
      biometrics.prompt = jest.fn().mockResolvedValue(false);

      const result = await service.authenticateBiometric();

      expect(result).toBe(false);
      expect(biometrics.prompt).toHaveBeenCalledWith(hwnd, consentMessage);
    });
  });

  describe("getStorageDetails", () => {
    it.each([
      ["testClientKeyHalfB64", "testIvB64"],
      [undefined, "testIvB64"],
      ["testClientKeyHalfB64", null],
      [undefined, null],
    ])(
      "should derive key material and ivB64 and return it when os key half not saved yet",
      async (clientKeyHalfB64, ivB64) => {
        service["_iv"] = ivB64;

        const derivedKeyMaterial = {
          keyB64: "derivedKeyB64",
          ivB64: "derivedIvB64",
        };
        biometrics.deriveKeyMaterial = jest.fn().mockResolvedValue(derivedKeyMaterial);

        const result = await service["getStorageDetails"]({ clientKeyHalfB64 });

        expect(result).toEqual({
          key_material: {
            osKeyPartB64: derivedKeyMaterial.keyB64,
            clientKeyPartB64: clientKeyHalfB64,
          },
          ivB64: derivedKeyMaterial.ivB64,
        });
        expect(biometrics.deriveKeyMaterial).toHaveBeenCalledWith(ivB64);
        expect(service["_osKeyHalf"]).toEqual(derivedKeyMaterial.keyB64);
        expect(service["_iv"]).toEqual(derivedKeyMaterial.ivB64);
      },
    );

    it("should throw an error when deriving key material and returned iv is null", async () => {
      service["_iv"] = "testIvB64";

      const derivedKeyMaterial = {
        keyB64: "derivedKeyB64",
        ivB64: null as string | undefined | null,
      };
      biometrics.deriveKeyMaterial = jest.fn().mockResolvedValue(derivedKeyMaterial);

      await expect(
        service["getStorageDetails"]({ clientKeyHalfB64: "testClientKeyHalfB64" }),
      ).rejects.toThrow("Initialization Vector is null");

      expect(biometrics.deriveKeyMaterial).toHaveBeenCalledWith("testIvB64");
    });
  });

  describe("setIv", () => {
    it("should set the iv and reset the osKeyHalf", () => {
      const iv = "testIv";
      service["_osKeyHalf"] = "testOsKeyHalf";

      service["setIv"](iv);

      expect(service["_iv"]).toBe(iv);
      expect(service["_osKeyHalf"]).toBeNull();
    });

    it("should set the iv to null when iv is undefined and reset the osKeyHalf", () => {
      service["_osKeyHalf"] = "testOsKeyHalf";

      service["setIv"](undefined);

      expect(service["_iv"]).toBeNull();
      expect(service["_osKeyHalf"]).toBeNull();
    });
  });
});
