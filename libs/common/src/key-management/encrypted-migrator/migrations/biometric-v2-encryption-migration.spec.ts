import { mock } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { BiometricStateService, BiometricsService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { CryptoClient } from "@bitwarden/sdk-internal";

import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { Utils } from "../../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";

import { BiometricV2EncryptionMigration } from "./biometric-v2-encryption-migration";

// Mock the SDK CryptoClient
jest.mock("@bitwarden/sdk-internal", () => ({
  CryptoClient: {
    get_key_id_for_symmetric_key: jest.fn(),
  },
}));

describe("BiometricV2EncryptionMigration", () => {
  const mockKeyService = mock<KeyService>();
  const mockBiometricsService = mock<BiometricsService>();
  const mockBiometricStateService = mock<BiometricStateService>();
  const mockConfigService = mock<ConfigService>();
  const mockLogService = mock<LogService>();

  let sut: BiometricV2EncryptionMigration;

  const mockUserId = "00000000-0000-0000-0000-000000000000" as UserId;
  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const mockKeyId = new Uint8Array([1, 2, 3, 4]);
  const mockKeyIdB64 = Utils.fromBufferToB64(mockKeyId);

  beforeEach(() => {
    jest.clearAllMocks();

    sut = new BiometricV2EncryptionMigration(
      mockKeyService,
      mockBiometricsService,
      mockBiometricStateService,
      mockConfigService,
      mockLogService,
    );
  });

  describe("needsMigration", () => {
    it("should return 'noMigrationNeeded' when feature flag is disabled", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(false);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockConfigService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.BiometricV2Migration,
      );
    });

    it("should return 'noMigrationNeeded' when biometric unlock is not enabled", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockBiometricStateService.getBiometricUnlockEnabled.mockResolvedValue(false);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });

    it("should return 'noMigrationNeeded' when user key is null (locked)", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockBiometricStateService.getBiometricUnlockEnabled.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(null));

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });

    it("should return 'noMigrationNeeded' when key has no key ID", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockBiometricStateService.getBiometricUnlockEnabled.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      (CryptoClient.get_key_id_for_symmetric_key as jest.Mock).mockReturnValue(undefined);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });

    it("should return 'noMigrationNeeded' when enrolled key ID matches current key ID", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockBiometricStateService.getBiometricUnlockEnabled.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      (CryptoClient.get_key_id_for_symmetric_key as jest.Mock).mockReturnValue(mockKeyId);
      mockBiometricStateService.getBiometricEnrolledKeyId.mockResolvedValue(mockKeyIdB64);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });

    it("should return 'needsMigration' when enrolled key ID does not match current key ID", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockBiometricStateService.getBiometricUnlockEnabled.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      (CryptoClient.get_key_id_for_symmetric_key as jest.Mock).mockReturnValue(mockKeyId);
      mockBiometricStateService.getBiometricEnrolledKeyId.mockResolvedValue("differentKeyId");

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("needsMigration");
    });

    it("should return 'needsMigration' when no enrolled key ID exists", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockBiometricStateService.getBiometricUnlockEnabled.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      (CryptoClient.get_key_id_for_symmetric_key as jest.Mock).mockReturnValue(mockKeyId);
      mockBiometricStateService.getBiometricEnrolledKeyId.mockResolvedValue(null);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("needsMigration");
    });
  });

  describe("runMigrations", () => {
    beforeEach(() => {
      (CryptoClient.get_key_id_for_symmetric_key as jest.Mock).mockReturnValue(mockKeyId);
    });

    it("should re-enroll ephemeral key with current user key", async () => {
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(false);

      await sut.runMigrations(mockUserId, null);

      expect(mockBiometricsService.setBiometricProtectedUnlockKeyForUser).toHaveBeenCalledWith(
        mockUserId,
        mockUserKey,
      );
    });

    it("should re-enroll persistent key when one exists", async () => {
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(true);

      await sut.runMigrations(mockUserId, null);

      expect(mockBiometricsService.enrollPersistent).toHaveBeenCalledWith(mockUserId, mockUserKey);
    });

    it("should not re-enroll persistent key when none exists", async () => {
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(false);

      await sut.runMigrations(mockUserId, null);

      expect(mockBiometricsService.enrollPersistent).not.toHaveBeenCalled();
    });

    it("should store the current key ID", async () => {
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(false);

      await sut.runMigrations(mockUserId, null);

      expect(mockBiometricStateService.setBiometricEnrolledKeyId).toHaveBeenCalledWith(
        mockUserId,
        mockKeyIdB64,
      );
    });

    it("should throw when user key is not available", async () => {
      mockKeyService.userKey$.mockReturnValue(of(null));

      await expect(sut.runMigrations(mockUserId, null)).rejects.toThrow(
        "User key is not available",
      );
    });
  });
});
