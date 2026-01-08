import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
    jest.clearAllMocks();

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
      canEnableBiometricUnlock: jest.fn(),
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

  describe("unlockWithBiometricsForUser", () => {
    it("should return null when desktop returns no key", async () => {
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(true);
      mockNativeMessagingClient.connect.mockResolvedValue();
      mockNativeMessagingClient.unlockWithBiometricsForUser.mockResolvedValue(null);

      const result = await service.unlockWithBiometricsForUser(mockUserId);

      expect(result).toBeNull();
    });

    it("should return UserKey when unlock succeeds and key is valid", async () => {
      // Create a valid 64-byte key as base64
      const mockKeyBytes = new Uint8Array(64);
      mockKeyBytes.fill(1);
      const mockKeyB64 = Buffer.from(mockKeyBytes).toString("base64");

      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(true);
      mockNativeMessagingClient.connect.mockResolvedValue();
      mockNativeMessagingClient.unlockWithBiometricsForUser.mockResolvedValue(mockKeyB64);
      keyService.validateUserKey.mockResolvedValue(true);

      const result = await service.unlockWithBiometricsForUser(mockUserId);

      expect(result).not.toBeNull();
      expect(keyService.validateUserKey).toHaveBeenCalled();
    });

    it("should return null when key validation fails", async () => {
      const mockKeyBytes = new Uint8Array(64);
      mockKeyBytes.fill(1);
      const mockKeyB64 = Buffer.from(mockKeyBytes).toString("base64");

      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(true);
      mockNativeMessagingClient.connect.mockResolvedValue();
      mockNativeMessagingClient.unlockWithBiometricsForUser.mockResolvedValue(mockKeyB64);
      keyService.validateUserKey.mockResolvedValue(false);

      const result = await service.unlockWithBiometricsForUser(mockUserId);

      expect(result).toBeNull();
    });

    it("should throw when biometric unlock fails", async () => {
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(true);
      mockNativeMessagingClient.connect.mockResolvedValue();
      mockNativeMessagingClient.unlockWithBiometricsForUser.mockRejectedValue(
        new Error("Biometric cancelled"),
      );

      await expect(service.unlockWithBiometricsForUser(mockUserId)).rejects.toThrow(
        "Biometric unlock failed",
      );
    });
  });

  describe("canEnableBiometricUnlock", () => {
    it("should return false when command fails", async () => {
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(true);
      mockNativeMessagingClient.connect.mockResolvedValue();
      mockNativeMessagingClient.canEnableBiometricUnlock.mockRejectedValue(
        new Error("Connection failed"),
      );

      const result = await service.canEnableBiometricUnlock();

      expect(result).toBe(false);
    });

    it("should return true when desktop app says biometrics can be enabled", async () => {
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(true);
      mockNativeMessagingClient.connect.mockResolvedValue();
      mockNativeMessagingClient.canEnableBiometricUnlock.mockResolvedValue(true);

      const result = await service.canEnableBiometricUnlock();

      expect(result).toBe(true);
    });

    it("should return false when desktop app says biometrics cannot be enabled", async () => {
      mockNativeMessagingClient.isDesktopAppAvailable.mockResolvedValue(true);
      mockNativeMessagingClient.connect.mockResolvedValue();
      mockNativeMessagingClient.canEnableBiometricUnlock.mockResolvedValue(false);

      const result = await service.canEnableBiometricUnlock();

      expect(result).toBe(false);
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
