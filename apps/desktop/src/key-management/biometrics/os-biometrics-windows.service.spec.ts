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
  // TODO is before each ?
  const sut = new OsBiometricsServiceWindows(i18nService, windowMain, logService);

  beforeEach(function () {
    windowMain.win = browserWindow;
    jest.clearAllMocks();
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
      jest.spyOn(sut, "getStorageDetails").mockResolvedValue({
        key_material: {
          osKeyPartB64: "testKeyB64",
          clientKeyPartB64: clientKeyHalfB64,
        },
        ivB64: "testIvB64",
      });

      const result = await sut.getBiometricKey(service, storageKey, clientKeyHalfB64);

      expect(result).toBe(biometricKey);
      expect(passwords.getPassword).toHaveBeenCalledWith(service, storageKey);
      expect(sut.getStorageDetails).toHaveBeenCalledWith({
        clientKeyHalfB64: clientKeyHalfB64,
      });
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
      jest.spyOn(sut, "getStorageDetails").mockResolvedValue({
        key_material: {
          osKeyPartB64: "testKeyB64",
          clientKeyPartB64: clientKeyHalfB64,
        },
        ivB64: "testIvB64",
      });
      jest.spyOn(sut, "setIv").mockImplementation();
      biometrics.getBiometricSecret = jest.fn().mockResolvedValue(biometricKey);

      const result = await sut.getBiometricKey(service, storageKey, clientKeyHalfB64);

      expect(result).toBe(biometricKey);
      expect(passwords.getPassword).toHaveBeenCalledWith(service, storageKey);
      expect(sut.getStorageDetails).toHaveBeenCalledWith({
        clientKeyHalfB64: clientKeyHalfB64,
      });
      expect(sut.setIv).toHaveBeenCalledWith("testId");
      expect(biometrics.setBiometricSecret).not.toHaveBeenCalled();
    });
  });
});
