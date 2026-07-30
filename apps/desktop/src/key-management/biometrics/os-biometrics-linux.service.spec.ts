import { mock } from "jest-mock-extended";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { passwords } from "@bitwarden/desktop-napi";
import { BiometricStateService } from "@bitwarden/key-management";

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

  const mockUserId = "test-user-id" as UserId;

  beforeEach(() => {
    const biometricStateService = mock<BiometricStateService>();
    const encryptService = mock<EncryptService>();
    const cryptoFunctionService = mock<CryptoFunctionService>();
    logService = mock<LogService>();
    service = new OsBiometricsServiceLinux(
      biometricStateService,
      encryptService,
      cryptoFunctionService,
      logService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("deleteBiometricKey", () => {
    const serviceName = "Bitwarden_biometric";
    const keyName = "test-user-id_user_biometric";

    it("should delete biometric key successfully", async () => {
      await service.deleteBiometricKey(mockUserId);

      expect(passwords.deletePassword).toHaveBeenCalledWith(serviceName, keyName);
    });

    it("should not throw error if key not found", async () => {
      passwords.deletePassword = jest
        .fn()
        .mockRejectedValueOnce(new Error(passwords.PASSWORD_NOT_FOUND));

      await service.deleteBiometricKey(mockUserId);

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

      await expect(service.deleteBiometricKey(mockUserId)).rejects.toThrow(error);

      expect(passwords.deletePassword).toHaveBeenCalledWith(serviceName, keyName);
    });
  });
});
