import { mock } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import {
  Argon2KdfConfig,
  KdfConfigService,
  KdfType,
  PBKDF2KdfConfig,
} from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { makeEncString } from "../../../../spec";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { SyncService } from "../../../platform/sync";
import { UserId } from "../../../types/guid";
import { EncString } from "../../crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "../../master-password/abstractions/master-password.service.abstraction";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../../master-password/types/master-password.types";

import { MinimumKdfMigration } from "./minimum-kdf-migration";

describe("MinimumKdfMigration", () => {
  const mockKdfConfigService = mock<KdfConfigService>();
  const mockSdkService = mock<SdkService>();
  const mockLogService = mock<LogService>();
  const mockConfigService = mock<ConfigService>();
  const mockMasterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
  const mockSyncService = mock<SyncService>();

  let sut: MinimumKdfMigration;

  const mockUserId = "00000000-0000-0000-0000-000000000000" as UserId;
  const mockMasterPassword = "masterPassword";

  const mockWrappedUserKey = makeEncString("wrappedUserKey");
  const mockUnlockData = new MasterPasswordUnlockData(
    "test@bitwarden.com" as MasterPasswordSalt,
    new PBKDF2KdfConfig(PBKDF2KdfConfig.ITERATIONS.min),
    mockWrappedUserKey.encryptedString as unknown as MasterKeyWrappedUserKey,
  );

  // SDK reference chain: sdk.take() -> ref.value.user_crypto_management().change_kdf(...)
  const changeKdf = jest.fn();
  const mockRef = {
    value: {
      user_crypto_management: jest.fn().mockReturnValue({ change_kdf: changeKdf }),
    },
    [Symbol.dispose]: jest.fn(),
  };
  const mockSdk = {
    take: jest.fn().mockReturnValue(mockRef),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSdkService.userClient$ = jest.fn(() => of(mockSdk)) as any;
    mockMasterPasswordService.masterPasswordUnlockData$ = jest.fn(() => of(mockUnlockData)) as any;

    sut = new MinimumKdfMigration(
      mockKdfConfigService,
      mockSdkService,
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
      const expectedKdf = new PBKDF2KdfConfig(PBKDF2KdfConfig.ITERATIONS.min);
      expect(changeKdf).toHaveBeenCalledWith(mockMasterPassword, expectedKdf.toSdkConfig());
      expect(mockMasterPasswordService.setLegacyMasterKeyFromUnlockData).toHaveBeenCalledWith(
        mockMasterPassword,
        mockUnlockData,
        mockUserId,
      );
      expect(mockMasterPasswordService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
        new EncString(mockWrappedUserKey.encryptedString),
        mockUserId,
      );

      // The SDK persists the new KDF config to state via the state bridge, so verify the
      // config passed to the SDK carries the minimum iteration count.
      const sdkKdfArg = changeKdf.mock.calls[0][1];
      expect(sdkKdfArg).toEqual(new PBKDF2KdfConfig(PBKDF2KdfConfig.ITERATIONS.min).toSdkConfig());
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

    it("should handle errors from the SDK change_kdf call", async () => {
      mockKdfConfigService.getKdfConfig.mockResolvedValue({
        kdfType: KdfType.PBKDF2_SHA256,
        iterations: PBKDF2KdfConfig.ITERATIONS.min - 1000,
      } as any);
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockMasterPasswordService.userHasMasterPassword.mockResolvedValue(true);

      const mockError = new Error("KDF update failed");
      changeKdf.mockRejectedValue(mockError);

      await expect(sut.runMigrations(mockUserId, mockMasterPassword)).rejects.toThrow(
        "KDF update failed",
      );

      expect(mockLogService.info).toHaveBeenCalledWith(
        `[MinimumKdfMigration] Updating user ${mockUserId} to minimum PBKDF2 iteration count ${PBKDF2KdfConfig.ITERATIONS.min}`,
      );
      const expectedKdf = new PBKDF2KdfConfig(PBKDF2KdfConfig.ITERATIONS.min);
      expect(changeKdf).toHaveBeenCalledWith(mockMasterPassword, expectedKdf.toSdkConfig());
    });
  });
});
