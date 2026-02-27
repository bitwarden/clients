import { mock } from "jest-mock-extended";

// eslint-disable-next-line no-restricted-imports
import { KdfConfigService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { ConfigService } from "../../platform/abstractions/config/config.service";
import { SyncService } from "../../platform/sync";
import { UserId } from "../../types/guid";
import { ChangeKdfService } from "../kdf/change-kdf.service.abstraction";
import { MasterPasswordServiceAbstraction } from "../master-password/abstractions/master-password.service.abstraction";

import { DefaultEncryptedMigrator } from "./default-encrypted-migrator";
import { EncryptedMigration } from "./migrations/encrypted-migration";
import { MinimumKdfMigration } from "./migrations/minimum-kdf-migration";

jest.mock("./migrations/minimum-kdf-migration");

describe("EncryptedMigrator", () => {
  const mockKdfConfigService = mock<KdfConfigService>();
  const mockChangeKdfService = mock<ChangeKdfService>();
  const mockLogService = mock<LogService>();
  const configService = mock<ConfigService>();
  const masterPasswordService = mock<MasterPasswordServiceAbstraction>();
  const syncService = mock<SyncService>();

  let sut: DefaultEncryptedMigrator;
  const mockMigration = mock<MinimumKdfMigration>();

  const mockUserId = "00000000-0000-0000-0000-000000000000" as UserId;
  const mockMasterPassword = "masterPassword123";

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the MinimumKdfMigration constructor to return our mock
    (MinimumKdfMigration as jest.MockedClass<typeof MinimumKdfMigration>).mockImplementation(
      () => mockMigration,
    );

    sut = new DefaultEncryptedMigrator(
      mockKdfConfigService,
      mockChangeKdfService,
      mockLogService,
      configService,
      masterPasswordService,
      syncService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("runMigrations", () => {
    it("should throw error when userId is null", async () => {
      await expect(sut.runMigrations(null as any, null)).rejects.toThrow("userId");
    });

    it("should throw error when userId is undefined", async () => {
      await expect(sut.runMigrations(undefined as any, null)).rejects.toThrow("userId");
    });

    it("should not run migration when needsMigration returns 'noMigrationNeeded'", async () => {
      mockMigration.needsMigration.mockResolvedValue("noMigrationNeeded");

      await sut.runMigrations(mockUserId, null);

      expect(mockMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
      expect(mockMigration.runMigrations).not.toHaveBeenCalled();
    });

    it("should run migration when needsMigration returns 'needsMigration'", async () => {
      mockMigration.needsMigration.mockResolvedValue("needsMigration");

      await sut.runMigrations(mockUserId, mockMasterPassword);

      expect(mockMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
      expect(mockMigration.runMigrations).toHaveBeenCalledWith(mockUserId, mockMasterPassword);
    });

    it("should run migration when needsMigration returns 'needsMigrationWithMasterPassword'", async () => {
      mockMigration.needsMigration.mockResolvedValue("needsMigrationWithMasterPassword");

      await sut.runMigrations(mockUserId, mockMasterPassword);

      expect(mockMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
      expect(mockMigration.runMigrations).toHaveBeenCalledWith(mockUserId, mockMasterPassword);
    });

    it("should throw error when migration needs master password but null is provided", async () => {
      mockMigration.needsMigration.mockResolvedValue("needsMigrationWithMasterPassword");

      await sut.runMigrations(mockUserId, null);
      expect(mockMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
      expect(mockMigration.runMigrations).not.toHaveBeenCalled();
    });

    it("should run multiple migrations", async () => {
      const mockSecondMigration = mock<EncryptedMigration>();
      mockSecondMigration.needsMigration.mockResolvedValue("needsMigration");

      (sut as any).migrations.push({
        name: "Test Second Migration",
        migration: mockSecondMigration,
      });

      mockMigration.needsMigration.mockResolvedValue("needsMigration");

      await sut.runMigrations(mockUserId, mockMasterPassword);

      expect(mockMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
      expect(mockSecondMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
      expect(mockMigration.runMigrations).toHaveBeenCalledWith(mockUserId, mockMasterPassword);
      expect(mockSecondMigration.runMigrations).toHaveBeenCalledWith(
        mockUserId,
        mockMasterPassword,
      );
    });
  });

  describe("needsMigrations", () => {
    it("should return 'noMigrationNeeded' when no migrations are needed", async () => {
      mockMigration.needsMigration.mockResolvedValue("noMigrationNeeded");

      const result = await sut.needsMigrations(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
    });

    it("should return 'needsMigration' when at least one migration needs to run", async () => {
      mockMigration.needsMigration.mockResolvedValue("needsMigration");

      const result = await sut.needsMigrations(mockUserId);

      expect(result).toBe("needsMigration");
      expect(mockMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
    });

    it("should return 'needsMigrationWithMasterPassword' when at least one migration needs master password", async () => {
      mockMigration.needsMigration.mockResolvedValue("needsMigrationWithMasterPassword");

      const result = await sut.needsMigrations(mockUserId);

      expect(result).toBe("needsMigrationWithMasterPassword");
      expect(mockMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
    });

    it("should prioritize 'needsMigrationWithMasterPassword' over 'needsMigration'", async () => {
      const mockSecondMigration = mock<EncryptedMigration>();
      mockSecondMigration.needsMigration.mockResolvedValue("needsMigration");

      (sut as any).migrations.push({
        name: "Test Second Migration",
        migration: mockSecondMigration,
      });

      mockMigration.needsMigration.mockResolvedValue("needsMigrationWithMasterPassword");

      const result = await sut.needsMigrations(mockUserId);

      expect(result).toBe("needsMigrationWithMasterPassword");
      expect(mockMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
      expect(mockSecondMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
    });

    it("should return 'needsMigration' when some migrations need running but none need master password", async () => {
      const mockSecondMigration = mock<EncryptedMigration>();
      mockSecondMigration.needsMigration.mockResolvedValue("noMigrationNeeded");

      (sut as any).migrations.push({
        name: "Test Second Migration",
        migration: mockSecondMigration,
      });

      mockMigration.needsMigration.mockResolvedValue("needsMigration");

      const result = await sut.needsMigrations(mockUserId);

      expect(result).toBe("needsMigration");
      expect(mockMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
      expect(mockSecondMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
    });

    it("should throw error when userId is null", async () => {
      await expect(sut.needsMigrations(null as any)).rejects.toThrow("userId");
    });

    it("should throw error when userId is undefined", async () => {
      await expect(sut.needsMigrations(undefined as any)).rejects.toThrow("userId");
    });
  });
});
