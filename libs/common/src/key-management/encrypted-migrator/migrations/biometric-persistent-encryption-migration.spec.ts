import { mock } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { BiometricStateService, BiometricsService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { CryptoClient } from "@bitwarden/sdk-internal";

import { Utils } from "../../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";

import { BiometricPersistentMigration } from "./biometric-persistent-encryption-migration";

// Mock the SDK CryptoClient
jest.mock("@bitwarden/sdk-internal", () => ({
  CryptoClient: {
    get_key_id_for_symmetric_key: jest.fn(),
  },
}));

describe("BiometricPersistentMigration", () => {
  const mockKeyService = mock<KeyService>();
  const mockBiometricsService = mock<BiometricsService>();
  const mockBiometricStateService = mock<BiometricStateService>();
  const mockLogService = mock<LogService>();
  const mockSdkService = { client$: of({ crypto: () => CryptoClient as any }) } as any;

  let sut: BiometricPersistentMigration;

  const mockUserId = "00000000-0000-0000-0000-000000000000" as UserId;
  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const mockKeyId = new Uint8Array([1, 2, 3, 4]);
  const mockKeyIdB64 = Utils.fromBufferToB64(mockKeyId);

  beforeEach(() => {
    jest.clearAllMocks();

    sut = new BiometricPersistentMigration(
      mockKeyService,
      mockBiometricsService,
      mockBiometricStateService,
      mockLogService,
      mockSdkService,
    );
  });

  describe("needsMigration", () => {
    it("should return 'noMigrationNeeded' when biometric unlock is not enabled", async () => {
      mockBiometricStateService.biometricUnlockEnabled$.mockReturnValue(of(false));

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });

    it("should return 'needsMigration' when enrolled key ID does not match current key ID (v2 to v2 migration)", async () => {
      mockBiometricStateService.biometricUnlockEnabled$.mockReturnValue(of(true));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      ((CryptoClient as any).get_key_id_for_symmetric_key as jest.Mock).mockReturnValue(mockKeyId);
      mockBiometricStateService.getBiometricEnrolledKeyId.mockResolvedValue("differentKeyId");

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("needsMigration");
    });

    it("should return 'needsMigration' when no enrolled key ID exists (v1 to v2 migration)", async () => {
      mockBiometricStateService.biometricUnlockEnabled$.mockReturnValue(of(true));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      ((CryptoClient as any).get_key_id_for_symmetric_key as jest.Mock).mockReturnValue(mockKeyId);
      mockBiometricStateService.getBiometricEnrolledKeyId.mockResolvedValue(null);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("needsMigration");
    });

    it("should return 'noMigrationNeeded' when enrolled key ID matches current key ID (v2 hot path)", async () => {
      mockBiometricStateService.biometricUnlockEnabled$.mockReturnValue(of(true));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      ((CryptoClient as any).get_key_id_for_symmetric_key as jest.Mock).mockReturnValue(mockKeyId);
      mockBiometricStateService.getBiometricEnrolledKeyId.mockResolvedValue(mockKeyIdB64);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });

    it("should return 'noMigrationNeeded' when no persistent key exists", async () => {
      mockBiometricStateService.biometricUnlockEnabled$.mockReturnValue(of(true));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(false);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });
  });

  describe("runMigrations", () => {
    beforeEach(() => {
      ((CryptoClient as any).get_key_id_for_symmetric_key as jest.Mock).mockReturnValue(mockKeyId);
    });

    it("should re-enroll persistent and ephemeral key on every migration", async () => {
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(false);

      await sut.runMigrations(mockUserId, null);

      expect(mockBiometricsService.enrollPersistent).toHaveBeenCalledWith(mockUserId, mockUserKey);
      expect(mockBiometricsService.setBiometricProtectedUnlockKeyForUser).toHaveBeenCalledWith(
        mockUserId,
        mockUserKey,
      );
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
  });
});
