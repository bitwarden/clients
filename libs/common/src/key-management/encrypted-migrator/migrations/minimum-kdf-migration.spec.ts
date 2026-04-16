import { mock } from "jest-mock-extended";

import { SyncService } from "@bitwarden/common/platform/sync";
// eslint-disable-next-line no-restricted-imports
import {
  Argon2KdfConfig,
  KdfConfigService,
  KdfType,
  PBKDF2KdfConfig,
} from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { UserId } from "../../../types/guid";
import { ChangeKdfService } from "../../kdf/change-kdf.service.abstraction";
import { MasterPasswordServiceAbstraction } from "../../master-password/abstractions/master-password.service.abstraction";

import { MinimumKdfMigration } from "./minimum-kdf-migration";

describe("MinimumKdfMigration", () => {
  const mockKdfConfigService = mock<KdfConfigService>();
  const mockChangeKdfService = mock<ChangeKdfService>();
  const mockLogService = mock<LogService>();
  const mockConfigService = mock<ConfigService>();
  const mockMasterPasswordService = mock<MasterPasswordServiceAbstraction>();
  const mockSyncService = mock<SyncService>();

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
      mockSyncService,
    );
  });

  describe("needsMigration", () => {
    it("should return 'noMigrationNeeded' when user does not have a master password`", async () => {
      mockMasterPasswordService.userHasMasterPassword.mockResolvedValue(false);
      const result = await sut.needsMigration(mockUserId);
      expect(result).toBe("noMigrationNeeded");
    });

    it("should return 'noMigrationNeeded' when user uses argon2id`", async () => {
      mockMasterPasswordService.userHasMasterPassword.mockResolvedValue(true);
      mockKdfConfigService.getKdfConfig.mockResolvedValue(new Argon2KdfConfig(3, 64, 4));
      const result = await sut.needsMigration(mockUserId);
      expect(result).toBe("noMigrationNeeded");
    });

    it("should return 'noMigrationNeeded' when PBKDF2 iterations are already above minimum", async () => {
      const mockKdfConfig = {
        kdfType: KdfType.PBKDF2_SHA256,
        iterations: PBKDF2KdfConfig.ITERATIONS.min + 1000,
      };
      mockKdfConfigService.getKdfConfig.mockResolvedValue(mockKdfConfig as any);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockKdfConfigService.getKdfConfig).toHaveBeenCalledWith(mockUserId);
    });

    it("should return 'noMigrationNeeded' when PBKDF2 iterations equal minimum", async () => {
      const mockKdfConfig = {
        kdfType: KdfType.PBKDF2_SHA256,
        iterations: PBKDF2KdfConfig.ITERATIONS.min,
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
        iterations: PBKDF2KdfConfig.ITERATIONS.min - 1000,
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
        iterations: PBKDF2KdfConfig.ITERATIONS.min - 1000,
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

    it("should return 'noMigrationNeeded' when sync updates local KDF state to no longer need migration", async () => {
      mockMasterPasswordService.userHasMasterPassword.mockResolvedValue(true);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockKdfConfigService.getKdfConfig
        .mockResolvedValueOnce({
          kdfType: KdfType.PBKDF2_SHA256,
          iterations: PBKDF2KdfConfig.ITERATIONS.min - 1000,
        } as any)
        .mockResolvedValueOnce({
          kdfType: KdfType.PBKDF2_SHA256,
          iterations: PBKDF2KdfConfig.ITERATIONS.min,
        } as any);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(false);
      expect(mockKdfConfigService.getKdfConfig).toHaveBeenCalledTimes(2);
      expect(mockLogService.info).toHaveBeenCalledWith(
        `[MinimumKdfMigration] After syncing, user ${mockUserId} does not need migration anymore. This means the migration was likely already performed on another client!`,
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
      mockKdfConfigService.getKdfConfig.mockResolvedValue({
        kdfType: KdfType.PBKDF2_SHA256,
        iterations: PBKDF2KdfConfig.ITERATIONS.min - 1000,
      } as any);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockMasterPasswordService.userHasMasterPassword.mockResolvedValue(true);

      await sut.runMigrations(mockUserId, mockMasterPassword);

      expect(mockLogService.info).toHaveBeenCalledWith(
        `[MinimumKdfMigration] Updating user ${mockUserId} to minimum PBKDF2 iteration count ${PBKDF2KdfConfig.ITERATIONS.min}`,
      );
      expect(mockChangeKdfService.updateUserKdfParams).toHaveBeenCalledWith(
        mockMasterPassword,
        expect.any(PBKDF2KdfConfig),
        mockUserId,
      );
      expect(mockKdfConfigService.setKdfConfig).toHaveBeenCalledWith(
        mockUserId,
        expect.any(PBKDF2KdfConfig),
      );

      // Verify the PBKDF2KdfConfig has the correct iteration count
      const kdfConfigArg = (mockChangeKdfService.updateUserKdfParams as jest.Mock).mock.calls[0][1];
      expect(kdfConfigArg.iterations).toBe(PBKDF2KdfConfig.ITERATIONS.min);
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
      mockKdfConfigService.getKdfConfig.mockResolvedValue({
        kdfType: KdfType.PBKDF2_SHA256,
        iterations: PBKDF2KdfConfig.ITERATIONS.min - 1000,
      } as any);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockMasterPasswordService.userHasMasterPassword.mockResolvedValue(true);

      const mockError = new Error("KDF update failed");
      mockChangeKdfService.updateUserKdfParams.mockRejectedValue(mockError);

      await expect(sut.runMigrations(mockUserId, mockMasterPassword)).rejects.toThrow(
        "KDF update failed",
      );

      expect(mockLogService.info).toHaveBeenCalledWith(
        `[MinimumKdfMigration] Updating user ${mockUserId} to minimum PBKDF2 iteration count ${PBKDF2KdfConfig.ITERATIONS.min}`,
      );
      expect(mockChangeKdfService.updateUserKdfParams).toHaveBeenCalledWith(
        mockMasterPassword,
        expect.any(PBKDF2KdfConfig),
        mockUserId,
      );
    });
  });
});
