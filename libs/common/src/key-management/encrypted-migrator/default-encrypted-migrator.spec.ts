import { mock } from "jest-mock-extended";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { KdfConfigService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { ChangeKdfServiceAbstraction } from "../kdf/abstractions/change-kdf-service";
import { MasterPasswordServiceAbstraction } from "../master-password/abstractions/master-password.service.abstraction";

import { DefaultEncryptedMigrator } from "./default-encrypted-migrator";
import { EncryptedMigration } from "./migrations/encrypted-migration";
import { MinimumKdfMigration } from "./migrations/minimum-kdf-migration";

jest.mock("./migrations/minimum-kdf-migration");

describe("EncryptedMigrator", () => {
  const mockKdfConfigService = mock<KdfConfigService>();
  const mockChangeKdfService = mock<ChangeKdfServiceAbstraction>();
  const mockLogService = mock<LogService>();
  const configService = mock<ConfigService>();
  const masterPasswordService = mock<MasterPasswordServiceAbstraction>();

  let sut: DefaultEncryptedMigrator;
  let mockMigration: jest.Mocked<MinimumKdfMigration>;

  const mockUserId = "00000000-0000-0000-0000-000000000000" as UserId;
  const mockMasterPassword = "masterPassword123";

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock instance of MinimumKdfMigration
    mockMigration = {
      needsMigration: jest.fn(),
      runMigrations: jest.fn(),
    } as unknown as jest.Mocked<MinimumKdfMigration>;

    // Mock the constructor of MinimumKdfMigration to return our mock
    (MinimumKdfMigration as jest.MockedClass<typeof MinimumKdfMigration>).mockImplementation(
      () => mockMigration,
    );

    sut = new DefaultEncryptedMigrator(
      mockKdfConfigService,
      mockChangeKdfService,
      mockLogService,
      configService,
      masterPasswordService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("runMigrations", () => {
    it("should throw error when userId is null", async () => {
      await expect(sut.runMigrations(null as any)).rejects.toThrow("userId");
    });

    it("should throw error when userId is undefined", async () => {
      await expect(sut.runMigrations(undefined as any)).rejects.toThrow("userId");
    });

    it("should not run migration when needsMigration returns 'noMigrationNeeded'", async () => {
      mockMigration.needsMigration.mockResolvedValue("noMigrationNeeded");

      await sut.runMigrations(mockUserId);

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

    it("should throw error when migration needs master password but none is provided", async () => {
      mockMigration.needsMigration.mockResolvedValue("needsMigrationWithMasterPassword");

      await expect(sut.runMigrations(mockUserId)).rejects.toThrow(
        "Master password is required to run migrations",
      );

      expect(mockMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
      expect(mockMigration.runMigrations).not.toHaveBeenCalled();
    });

    it("should throw error when migration needs master password but null is provided", async () => {
      mockMigration.needsMigration.mockResolvedValue("needsMigrationWithMasterPassword");

      await expect(sut.runMigrations(mockUserId, null)).rejects.toThrow(
        "Master password is required to run migrations",
      );

      expect(mockMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
      expect(mockMigration.runMigrations).not.toHaveBeenCalled();
    });

    it("should throw error when migration needs master password but empty string is provided", async () => {
      mockMigration.needsMigration.mockResolvedValue("needsMigrationWithMasterPassword");

      await expect(sut.runMigrations(mockUserId, "")).rejects.toThrow(
        "Master password is required to run migrations",
      );

      expect(mockMigration.needsMigration).toHaveBeenCalledWith(mockUserId);
      expect(mockMigration.runMigrations).not.toHaveBeenCalled();
    });

    it("should run multiple migrations", async () => {
      // Create a second mock migration
      const mockSecondMigration = mock<EncryptedMigration>();
      mockSecondMigration.needsMigration.mockResolvedValue("needsMigration");

      // Add a second migration manually to test multiple migrations
      (sut as any).migrations.push({
        name: "Test Second Migration",
        migration: mockSecondMigration,
      });

      mockMigration.needsMigration.mockResolvedValue("needsMigration");

      await sut.runMigrations(mockUserId, mockMasterPassword);

      // Verify both migrations were checked and run
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
      // Create a second mock migration
      const mockSecondMigration = mock<EncryptedMigration>();
      mockSecondMigration.needsMigration.mockResolvedValue("needsMigration");

      // Add a second migration manually to test multiple migrations
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
      // Create a second mock migration
      const mockSecondMigration = mock<EncryptedMigration>();
      mockSecondMigration.needsMigration.mockResolvedValue("noMigrationNeeded");

      // Add a second migration manually to test multiple migrations
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
