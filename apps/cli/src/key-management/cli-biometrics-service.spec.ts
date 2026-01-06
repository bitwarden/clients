import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AccountInfo } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsStatus, KeyService } from "@bitwarden/key-management";

import { CliBiometricsService } from "./cli-biometrics-service";

describe("CliBiometricsService", () => {
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let appIdService: MockProxy<AppIdService>;
  let logService: MockProxy<LogService>;
  let accountService: MockProxy<AccountService>;

  let service: CliBiometricsService;

  const mockUserId = "mock-user-id" as UserId;

  beforeEach(() => {
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    cryptoFunctionService = mock<CryptoFunctionService>();
    appIdService = mock<AppIdService>();
    logService = mock<LogService>();
    accountService = mock<AccountService>();

    // Mock active account
    const accountSubject = new BehaviorSubject<{ id: UserId; email: string } | null>({
      id: mockUserId,
      email: "test@example.com",
    } as AccountInfo & { id: UserId });
    accountService.activeAccount$ = accountSubject.asObservable() as any;

    service = new CliBiometricsService(
      keyService,
      encryptService,
      cryptoFunctionService,
      appIdService,
      logService,
      accountService,
    );
  });

  afterEach(() => {
    service.disconnect();
  });

  describe("getBiometricsStatus", () => {
    it("should return DesktopDisconnected when desktop app is not available", async () => {
      // In test environment, desktop app socket won't exist
      const status = await service.getBiometricsStatus();
      expect(status).toBe(BiometricsStatus.DesktopDisconnected);
    });
  });

  describe("getBiometricsStatusForUser", () => {
    it("should return DesktopDisconnected when desktop app is not available", async () => {
      const status = await service.getBiometricsStatusForUser(mockUserId);
      expect(status).toBe(BiometricsStatus.DesktopDisconnected);
    });
  });

  describe("authenticateWithBiometrics", () => {
    it("should return false when desktop app is not available", async () => {
      const result = await service.authenticateWithBiometrics();
      expect(result).toBe(false);
    });
  });

  describe("getShouldAutopromptNow", () => {
    it("should always return false for CLI", async () => {
      const result = await service.getShouldAutopromptNow();
      expect(result).toBe(false);
    });
  });

  describe("canEnableBiometricUnlock", () => {
    it("should return false when desktop is disconnected", async () => {
      const result = await service.canEnableBiometricUnlock();
      expect(result).toBe(false);
    });
  });

  describe("getBiometricsStatusDescription", () => {
    it("should return appropriate description for disconnected status", async () => {
      const description = await service.getBiometricsStatusDescription();
      expect(description).toContain("Desktop app is not running");
    });
  });

  describe("isBiometricUnlockAvailable", () => {
    it("should return false when desktop app is not available", async () => {
      const result = await service.isBiometricUnlockAvailable();
      expect(result).toBe(false);
    });
  });
});

