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

import { NativeMessagingClient } from "./biometrics/native-messaging-client";
import { CliBiometricsService } from "./cli-biometrics-service";

// Mock the NativeMessagingClient module
jest.mock("./biometrics/native-messaging-client");

describe("CliBiometricsService", () => {
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let appIdService: MockProxy<AppIdService>;
  let logService: MockProxy<LogService>;
  let accountService: MockProxy<AccountService>;
  let mockNativeMessagingClient: jest.Mocked<NativeMessagingClient>;

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

    // Set up the mock NativeMessagingClient
    mockNativeMessagingClient = {
      isDesktopAppAvailable: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      getBiometricsStatus: jest.fn(),
      getBiometricsStatusForUser: jest.fn(),
      unlockWithBiometricsForUser: jest.fn(),
      authenticateWithBiometrics: jest.fn(),
    } as unknown as jest.Mocked<NativeMessagingClient>;

    (NativeMessagingClient as jest.Mock).mockImplementation(() => mockNativeMessagingClient);

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
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(false);

      const status = await service.getBiometricsStatus();

      expect(status).toBe(BiometricsStatus.DesktopDisconnected);
    });

    it("should return status from desktop app when available", async () => {
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(true);
      mockNativeMessagingClient.connect.mockResolvedValue();
      mockNativeMessagingClient.getBiometricsStatus.mockResolvedValue(BiometricsStatus.Available);

      const status = await service.getBiometricsStatus();

      expect(status).toBe(BiometricsStatus.Available);
    });
  });

  describe("getBiometricsStatusForUser", () => {
    it("should return DesktopDisconnected when desktop app is not available", async () => {
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(false);

      const status = await service.getBiometricsStatusForUser(mockUserId);

      expect(status).toBe(BiometricsStatus.DesktopDisconnected);
    });

    it("should return user status from desktop app when available", async () => {
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(true);
      mockNativeMessagingClient.connect.mockResolvedValue();
      mockNativeMessagingClient.getBiometricsStatusForUser.mockResolvedValue(
        BiometricsStatus.Available,
      );

      const status = await service.getBiometricsStatusForUser(mockUserId);

      expect(status).toBe(BiometricsStatus.Available);
    });
  });

  describe("authenticateWithBiometrics", () => {
    it("should return false when authentication fails", async () => {
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(true);
      mockNativeMessagingClient.connect.mockResolvedValue();
      mockNativeMessagingClient.authenticateWithBiometrics.mockRejectedValue(
        new Error("Auth failed"),
      );

      const result = await service.authenticateWithBiometrics();

      expect(result).toBe(false);
    });

    it("should return true when authentication succeeds", async () => {
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(true);
      mockNativeMessagingClient.connect.mockResolvedValue();
      mockNativeMessagingClient.authenticateWithBiometrics.mockResolvedValue(true);

      const result = await service.authenticateWithBiometrics();

      expect(result).toBe(true);
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
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(false);

      const result = await service.canEnableBiometricUnlock();

      expect(result).toBe(false);
    });

    it("should return true when biometrics is available", async () => {
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(true);
      mockNativeMessagingClient.connect.mockResolvedValue();
      mockNativeMessagingClient.getBiometricsStatus.mockResolvedValue(BiometricsStatus.Available);

      const result = await service.canEnableBiometricUnlock();

      expect(result).toBe(true);
    });
  });

  describe("getBiometricsStatusDescription", () => {
    it("should return appropriate description for disconnected status", async () => {
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(false);

      const description = await service.getBiometricsStatusDescription();

      expect(description).toContain("Desktop app is not running");
    });

    it("should return appropriate description for available status", async () => {
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(true);
      mockNativeMessagingClient.connect.mockResolvedValue();
      mockNativeMessagingClient.getBiometricsStatus.mockResolvedValue(BiometricsStatus.Available);

      const description = await service.getBiometricsStatusDescription();

      expect(description).toContain("available via Desktop app");
    });
  });

  describe("isBiometricUnlockAvailable", () => {
    it("should return false when desktop app is not available", async () => {
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(false);

      const result = await service.isBiometricUnlockAvailable();

      expect(result).toBe(false);
    });

    it("should return true when biometrics available for user", async () => {
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(true);
      mockNativeMessagingClient.connect.mockResolvedValue();
      mockNativeMessagingClient.getBiometricsStatusForUser.mockResolvedValue(
        BiometricsStatus.Available,
      );

      const result = await service.isBiometricUnlockAvailable();

      expect(result).toBe(true);
    });
  });
});
