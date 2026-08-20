import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { LogService } from "@bitwarden/logging";

import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { SyncService } from "../../../platform/sync";
import { UserId } from "../../../types/guid";

import { UserKeyIdBackfillMigration } from "./user-key-id-backfill-migration";

describe("UserKeyIdBackfillMigration", () => {
  const mockSdkService = mock<SdkService>();
  const mockSyncService = mock<SyncService>();
  const mockLogService = mock<LogService>();

  let sut: UserKeyIdBackfillMigration;

  const mockUserId = "00000000-0000-0000-0000-000000000000" as UserId;

  // SDK reference chain: sdk.take() -> ref.value.user_crypto_management().user_key_id_backfill()
  const needsBackfill = jest.fn();
  const backfill = jest.fn();
  const mockRef = {
    value: {
      user_crypto_management: jest.fn().mockReturnValue({
        user_key_id_needs_backfill: needsBackfill,
        user_key_id_backfill: backfill,
      }),
    },
    [Symbol.dispose]: jest.fn(),
  };
  const mockSdk = {
    take: jest.fn().mockReturnValue(mockRef),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSdkService.userClient$ = jest.fn(() => of(mockSdk)) as any;

    sut = new UserKeyIdBackfillMigration(mockSdkService, mockSyncService, mockLogService);
  });

  describe("needsMigration", () => {
    it.each([null, undefined])("throws when userId is %s", async (userId) => {
      await expect(sut.needsMigration(userId as any)).rejects.toThrow("userId");
    });

    it("returns 'noMigrationNeeded' without syncing when the server already knows the key id", async () => {
      needsBackfill.mockResolvedValue(false);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockSyncService.fullSync).not.toHaveBeenCalled();
    });

    it("returns 'needsMigration' when the server is still missing the key id after syncing", async () => {
      needsBackfill.mockResolvedValue(true);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("needsMigration");
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(false);
      expect(needsBackfill).toHaveBeenCalledTimes(2);
    });

    it("returns 'noMigrationNeeded' when the sync reveals another client already backfilled", async () => {
      needsBackfill.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(false);
    });

    it("returns 'noMigrationNeeded' when the SDK cannot evaluate the backfill", async () => {
      // e.g. the account is locked, so the user key is not in the key store
      needsBackfill.mockRejectedValue(new Error("User key is not available in key store"));

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockLogService.warning).toHaveBeenCalled();
    });
  });

  describe("runMigrations", () => {
    it.each([null, undefined])("throws when userId is %s", async (userId) => {
      await expect(sut.runMigrations(userId as any)).rejects.toThrow("userId");
    });

    it("records the key id with the server", async () => {
      await sut.runMigrations(mockUserId);

      expect(backfill).toHaveBeenCalledTimes(1);
    });

    it("propagates a failure to record the key id", async () => {
      backfill.mockRejectedValue(new Error("API call failed during user key id backfill"));

      await expect(sut.runMigrations(mockUserId)).rejects.toThrow(
        "API call failed during user key id backfill",
      );
    });
  });
});
