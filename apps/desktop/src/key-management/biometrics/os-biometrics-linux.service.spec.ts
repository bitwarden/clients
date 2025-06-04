import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { passwords } from "@bitwarden/desktop-napi";

import OsBiometricsServiceLinux from "./os-biometrics-linux.service";

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

describe("OsBiometricsServiceLinux", () => {
  let service: OsBiometricsServiceLinux;
  let logService: LogService;

  beforeEach(() => {
    logService = mock<LogService>();
    service = new OsBiometricsServiceLinux(logService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("deleteBiometricKey", () => {
    const serviceName = "testService";
    const keyName = "testKey";

    it("should delete biometric key successfully", async () => {
      await service.deleteBiometricKey(serviceName, keyName);

      expect(passwords.deletePassword).toHaveBeenCalledWith(serviceName, keyName);
    });

    it("should not throw error if key not found", async () => {
      passwords.deletePassword = jest
        .fn()
        .mockRejectedValueOnce(new Error(passwords.PASSWORD_NOT_FOUND));

      await service.deleteBiometricKey(serviceName, keyName);

      expect(passwords.deletePassword).toHaveBeenCalledWith(serviceName, keyName);
      expect(logService.debug).toHaveBeenCalledWith(
        "[OsBiometricService] Biometric key %s not found for service %s.",
        keyName,
        serviceName,
      );
    });

    it("should throw error for unexpected errors", async () => {
      const error = new Error("Unexpected error");
      passwords.deletePassword = jest.fn().mockRejectedValueOnce(error);

      await expect(service.deleteBiometricKey(serviceName, keyName)).rejects.toThrow(error);

      expect(passwords.deletePassword).toHaveBeenCalledWith(serviceName, keyName);
    });
  });
});
