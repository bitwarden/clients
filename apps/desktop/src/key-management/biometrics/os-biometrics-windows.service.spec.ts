import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { passwords } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";

import OsBiometricsServiceWindows from "./os-biometrics-windows.service";

jest.mock("@bitwarden/desktop-napi", () => ({
  biometrics: {
    setBiometricSecret: jest.fn(),
    getBiometricSecret: jest.fn(),
    deleteBiometricSecret: jest.fn(),
    prompt: jest.fn(),
    available: jest.fn(),
    deriveKeyMaterial: jest.fn(),
  },
  passwords: {
    deletePassword: jest.fn(),
    getPassword: jest.fn(),
    isAvailable: jest.fn(),
    PASSWORD_NOT_FOUND: "Password not found",
  },
}));

describe("OsBiometricsServiceWindows", () => {
  let service: OsBiometricsServiceWindows;
  let i18nService: I18nService;
  let windowMain: WindowMain;
  let logService: LogService;

  beforeEach(() => {
    i18nService = mock<I18nService>();
    windowMain = mock<WindowMain>();
    logService = mock<LogService>();
    service = new OsBiometricsServiceWindows(i18nService, windowMain, logService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("deleteBiometricKey", () => {
    const serviceName = "testService";
    const keyName = "testKey";
    const witnessKeyName = "testKey_witness";

    it("should delete biometric key successfully", async () => {
      await service.deleteBiometricKey(serviceName, keyName);

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

        await service.deleteBiometricKey(serviceName, keyName);

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

      await expect(service.deleteBiometricKey(serviceName, keyName)).rejects.toThrow(error);

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

      await expect(service.deleteBiometricKey(serviceName, keyName)).rejects.toThrow(error);

      expect(passwords.deletePassword).toHaveBeenCalledWith(serviceName, keyName);
      expect(passwords.deletePassword).toHaveBeenCalledWith(serviceName, witnessKeyName);
    });
  });
});
