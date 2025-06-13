import { BrowserWindow } from "electron";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { biometrics, passwords } from "@bitwarden/desktop-napi";

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
    },
  };
});

describe("OsBiometricsServiceWindows", function () {
  const i18nService = mock<I18nService>();
  const windowMain = mock<WindowMain>();
  const logService = mock<LogService>();
  const browserWindow = mock<BrowserWindow>();

  let sut: OsBiometricsServiceWindows;

  beforeEach(function () {
    windowMain.win = browserWindow;
    jest.clearAllMocks();
    sut = new OsBiometricsServiceWindows(i18nService, windowMain, logService);
  });

  describe("osSupportsBiometric", () => {
    it("should return true if biometrics are available", async () => {
      biometrics.available = jest.fn().mockResolvedValue(true);

      const result = await sut.osSupportsBiometric();

      expect(result).toBe(true);
    });

    it("should return false if biometrics are not available", async () => {
      biometrics.available = jest.fn().mockResolvedValue(false);

      const result = await sut.osSupportsBiometric();

      expect(result).toBe(false);
    });
  });

  describe("getBiometricKey", () => {
    const service = "testService";
    const storageKey = "testStorageKey";
    const clientKeyHalfB64 = "testClientKeyHalfB64";

    beforeEach(() => {
      biometrics.prompt = jest.fn().mockResolvedValue(true);
    });

    it("should throw error when unsuccessfully authenticated biometrics", async () => {
      biometrics.prompt = jest.fn().mockResolvedValue(false);

      await expect(sut.getBiometricKey(service, storageKey, clientKeyHalfB64)).rejects.toThrow(
        new Error("Biometric authentication failed"),
      );
    });

    it.each([null, undefined, ""])(
      "should return null if no password is found '%s'",
      async (password) => {
        passwords.getPassword = jest.fn().mockResolvedValue(password);

        const result = await sut.getBiometricKey(service, storageKey, clientKeyHalfB64);

        expect(result).toBeNull();
        expect(passwords.getPassword).toHaveBeenCalledWith(service, storageKey);
      },
    );

    it("should return the biometricKey and setBiometricSecret called if password is not encrypted", async () => {
      const biometricKey = "biometricKey";
      passwords.getPassword = jest.fn().mockResolvedValue(biometricKey);
      sut["_osKeyHalf"] = "testKeyB64";
      sut["_iv"] = "testIvB64";

      const result = await sut.getBiometricKey(service, storageKey, clientKeyHalfB64);

      expect(result).toBe(biometricKey);
      expect(passwords.getPassword).toHaveBeenCalledWith(service, storageKey);
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
      sut["_osKeyHalf"] = "testKeyB64";
      sut["_iv"] = "testIvB64";
      biometrics.getBiometricSecret = jest.fn().mockResolvedValue(biometricKey);

      const result = await sut.getBiometricKey(service, storageKey, clientKeyHalfB64);

      expect(result).toBe(biometricKey);
      expect(passwords.getPassword).toHaveBeenCalledWith(service, storageKey);
      expect(biometrics.setBiometricSecret).not.toHaveBeenCalled();
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
        sut["_iv"] = ivB64;

        const derivedKeyMaterial = {
          keyB64: "derivedKeyB64",
          ivB64: "derivedIvB64",
        };
        biometrics.deriveKeyMaterial = jest.fn().mockResolvedValue(derivedKeyMaterial);

        const result = await sut["getStorageDetails"]({ clientKeyHalfB64 });

        expect(result).toEqual({
          key_material: {
            osKeyPartB64: derivedKeyMaterial.keyB64,
            clientKeyPartB64: clientKeyHalfB64,
          },
          ivB64: derivedKeyMaterial.ivB64,
        });
        expect(biometrics.deriveKeyMaterial).toHaveBeenCalledWith(ivB64);
        expect(sut["_osKeyHalf"]).toEqual(derivedKeyMaterial.keyB64);
        expect(sut["_iv"]).toEqual(derivedKeyMaterial.ivB64);
      },
    );

    it("should throw an error when deriving key material and returned iv is null", async () => {
      sut["_iv"] = "testIvB64";

      const derivedKeyMaterial = {
        keyB64: "derivedKeyB64",
        ivB64: null as string | undefined | null,
      };
      biometrics.deriveKeyMaterial = jest.fn().mockResolvedValue(derivedKeyMaterial);

      await expect(
        sut["getStorageDetails"]({ clientKeyHalfB64: "testClientKeyHalfB64" }),
      ).rejects.toThrow("Initialization Vector is null");

      expect(biometrics.deriveKeyMaterial).toHaveBeenCalledWith("testIvB64");
    });
  });

  describe("setIv", () => {
    it("should set the iv and reset the osKeyHalf", () => {
      const iv = "testIv";
      sut["_osKeyHalf"] = "testOsKeyHalf";

      sut["setIv"](iv);

      expect(sut["_iv"]).toBe(iv);
      expect(sut["_osKeyHalf"]).toBeNull();
    });

    it("should set the iv to null when iv is undefined and reset the osKeyHalf", () => {
      sut["_osKeyHalf"] = "testOsKeyHalf";

      sut["setIv"](undefined);

      expect(sut["_iv"]).toBeNull();
      expect(sut["_osKeyHalf"]).toBeNull();
    });
  });
});
