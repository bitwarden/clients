import { mock } from "jest-mock-extended";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import {
  KdfConfigService,
  KdfType,
  MINIMUM_PBKDF2_ITERATIONS_FOR_UPGRADE,
  PBKDF2KdfConfig,
} from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { ChangeKdfServiceAbstraction } from "../../kdf/abstractions/change-kdf-service";
import { MasterPasswordServiceAbstraction } from "../../master-password/abstractions/master-password.service.abstraction";

import { MinimumKdfMigration } from "./minimum-kdf-migration";

describe("MinimumKdfMigration", () => {
  const mockKdfConfigService = mock<KdfConfigService>();
  const mockChangeKdfService = mock<ChangeKdfServiceAbstraction>();
  const mockLogService = mock<LogService>();
  const mockConfigService = mock<ConfigService>();
  const mockMasterPasswordService = mock<MasterPasswordServiceAbstraction>();

  let sut: MinimumKdfMigration;

  const mockUserId = "00000000-0000-0000-0000-000000000000" as UserId;
  const mockMasterPassword = "masterPassword";

  beforeEach(() => {
    jest.clearAllMocks();

    sut = new MinimumKdfMigration(
      mockKdfConfigService,
      mockChangeKdfService,
      mockLogService,
      mockConfigService,
      mockMasterPasswordService,
    );
  });

  describe("needsMigration", () => {
    it("should return 'noMigrationNeeded' when user is not using PBKDF2", async () => {
      const mockKdfConfig = {
        kdfType: KdfType.Argon2id,
        iterations: 100000,
      };
      mockKdfConfigService.getKdfConfig.mockResolvedValue(mockKdfConfig as any);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockKdfConfigService.getKdfConfig).toHaveBeenCalledWith(mockUserId);
    });

    it("should return 'noMigrationNeeded' when PBKDF2 iterations are already above minimum", async () => {
      const mockKdfConfig = {
        kdfType: KdfType.PBKDF2_SHA256,
        iterations: MINIMUM_PBKDF2_ITERATIONS_FOR_UPGRADE + 1000,
      };
      mockKdfConfigService.getKdfConfig.mockResolvedValue(mockKdfConfig as any);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockKdfConfigService.getKdfConfig).toHaveBeenCalledWith(mockUserId);
    });

    it("should return 'noMigrationNeeded' when PBKDF2 iterations equal minimum", async () => {
      const mockKdfConfig = {
        kdfType: KdfType.PBKDF2_SHA256,
        iterations: MINIMUM_PBKDF2_ITERATIONS_FOR_UPGRADE,
      };
      mockKdfConfigService.getKdfConfig.mockResolvedValue(mockKdfConfig as any);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockKdfConfigService.getKdfConfig).toHaveBeenCalledWith(mockUserId);
    });

    it("should return 'noMigrationNeeded' when feature flag is disabled", async () => {
      const mockKdfConfig = {
        kdfType: KdfType.PBKDF2_SHA256,
        iterations: MINIMUM_PBKDF2_ITERATIONS_FOR_UPGRADE - 1000,
      };
      mockKdfConfigService.getKdfConfig.mockResolvedValue(mockKdfConfig as any);
      mockConfigService.getFeatureFlag.mockResolvedValue(false);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockKdfConfigService.getKdfConfig).toHaveBeenCalledWith(mockUserId);
      expect(mockConfigService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.ForceUpdateKDFSettings,
      );
    });

    it("should return 'needsMigrationWithMasterPassword' when PBKDF2 iterations are below minimum and feature flag is enabled", async () => {
      const mockKdfConfig = {
        kdfType: KdfType.PBKDF2_SHA256,
        iterations: MINIMUM_PBKDF2_ITERATIONS_FOR_UPGRADE - 1000,
      };
      mockKdfConfigService.getKdfConfig.mockResolvedValue(mockKdfConfig as any);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("needsMigrationWithMasterPassword");
      expect(mockKdfConfigService.getKdfConfig).toHaveBeenCalledWith(mockUserId);
      expect(mockConfigService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.ForceUpdateKDFSettings,
      );
    });

    it("should throw error when userId is null", async () => {
      await expect(sut.needsMigration(null as any)).rejects.toThrow("userId");
    });

    it("should throw error when userId is undefined", async () => {
      await expect(sut.needsMigration(undefined as any)).rejects.toThrow("userId");
    });
  });

  describe("runMigrations", () => {
    it("should update KDF parameters with minimum PBKDF2 iterations", async () => {
      await sut.runMigrations(mockUserId, mockMasterPassword);

      expect(mockLogService.info).toHaveBeenCalledWith(
        `[MinimumKdfMigration] Updating user ${mockUserId} to minimum PBKDF2 iteration count ${MINIMUM_PBKDF2_ITERATIONS_FOR_UPGRADE}`,
      );
      expect(mockChangeKdfService.updateUserKdfParams).toHaveBeenCalledWith(
        mockMasterPassword,
        expect.any(PBKDF2KdfConfig),
        mockUserId,
      );

      // Verify the PBKDF2KdfConfig has the correct iteration count
      const kdfConfigArg = (mockChangeKdfService.updateUserKdfParams as jest.Mock).mock.calls[0][1];
      expect(kdfConfigArg.iterations).toBe(MINIMUM_PBKDF2_ITERATIONS_FOR_UPGRADE);
    });

    it("should throw error when userId is null", async () => {
      await expect(sut.runMigrations(null as any, mockMasterPassword)).rejects.toThrow("userId");
    });

    it("should throw error when userId is undefined", async () => {
      await expect(sut.runMigrations(undefined as any, mockMasterPassword)).rejects.toThrow(
        "userId",
      );
    });

    it("should throw error when masterPassword is null", async () => {
      await expect(sut.runMigrations(mockUserId, null as any)).rejects.toThrow("masterPassword");
    });

    it("should throw error when masterPassword is undefined", async () => {
      await expect(sut.runMigrations(mockUserId, undefined as any)).rejects.toThrow(
        "masterPassword",
      );
    });

    it("should handle errors from changeKdfService", async () => {
      const mockError = new Error("KDF update failed");
      mockChangeKdfService.updateUserKdfParams.mockRejectedValue(mockError);

      await expect(sut.runMigrations(mockUserId, mockMasterPassword)).rejects.toThrow(
        "KDF update failed",
      );

      expect(mockLogService.info).toHaveBeenCalledWith(
        `[MinimumKdfMigration] Updating user ${mockUserId} to minimum PBKDF2 iteration count ${MINIMUM_PBKDF2_ITERATIONS_FOR_UPGRADE}`,
      );
      expect(mockChangeKdfService.updateUserKdfParams).toHaveBeenCalledWith(
        mockMasterPassword,
        expect.any(PBKDF2KdfConfig),
        mockUserId,
      );
    });
  });
});
