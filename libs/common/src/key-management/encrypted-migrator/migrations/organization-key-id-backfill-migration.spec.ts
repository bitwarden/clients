import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { LogService } from "@bitwarden/logging";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { SyncService } from "../../../platform/sync";
import { UserId } from "../../../types/guid";

import {
  ORGANIZATION_KEY_ID_BACKFILL_COOLDOWN,
  OrganizationKeyIdBackfillMigration,
} from "./organization-key-id-backfill-migration";

describe("OrganizationKeyIdBackfillMigration", () => {
  const mockSdkService = mock<SdkService>();
  const mockSyncService = mock<SyncService>();
  const mockLogService = mock<LogService>();

  let stateProvider: FakeStateProvider;
  let sut: OrganizationKeyIdBackfillMigration;

  const mockUserId = "00000000-0000-0000-0000-000000000000" as UserId;
  const mockOrganizationId = "11111111-1111-1111-1111-111111111111";
  const HOUR_MS = 1000 * 60 * 60;

  /**
   * Fabricates the shape the SDK produces for an `OrganizationKeyIdBackfillError`. The name and
   * variant fields are what `isOrganizationKeyIdBackfillError` uses to identify the error.
   */
  const makeBackfillError = (variant: string, message: string): Error => {
    const error = new Error(message);
    error.name = "OrganizationKeyIdBackfillError";
    (error as Error & { variant: string }).variant = variant;

    return error;
  };

  // SDK reference chain:
  // sdk.take() -> ref.value.organization_crypto_management().organization_key_id_backfill()
  const organizationsNeedingBackfill = jest.fn();
  const backfill = jest.fn();
  const mockRef = {
    value: {
      organization_crypto_management: jest.fn().mockReturnValue({
        organization_key_ids_needing_backfill: organizationsNeedingBackfill,
        organization_key_id_backfill: backfill,
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

    stateProvider = new FakeStateProvider(mockAccountServiceWith(mockUserId));

    sut = new OrganizationKeyIdBackfillMigration(
      mockSdkService,
      mockSyncService,
      stateProvider,
      mockLogService,
    );
  });

  describe("needsMigration", () => {
    it.each([null, undefined])("throws when userId is %s", async (userId) => {
      await expect(sut.needsMigration(userId as any)).rejects.toThrow("userId");
    });

    it("returns 'noMigrationNeeded' without syncing when no organization needs a backfill", async () => {
      organizationsNeedingBackfill.mockResolvedValue([]);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockSyncService.fullSync).not.toHaveBeenCalled();
    });

    it("returns 'needsMigration' when an organization still needs a backfill after syncing", async () => {
      organizationsNeedingBackfill.mockResolvedValue([mockOrganizationId]);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("needsMigration");
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(false);
      expect(organizationsNeedingBackfill).toHaveBeenCalledTimes(2);
    });

    it("returns 'noMigrationNeeded' when the sync reveals another client already backfilled", async () => {
      organizationsNeedingBackfill
        .mockResolvedValueOnce([mockOrganizationId])
        .mockResolvedValueOnce([]);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(false);
    });

    it("returns 'noMigrationNeeded' without syncing while a failed attempt is in cooldown", async () => {
      organizationsNeedingBackfill.mockResolvedValue([mockOrganizationId]);
      await stateProvider.setUserState(
        ORGANIZATION_KEY_ID_BACKFILL_COOLDOWN,
        new Date(new Date().getTime() - 1 * HOUR_MS),
        mockUserId,
      );

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockSyncService.fullSync).not.toHaveBeenCalled();
      expect(organizationsNeedingBackfill).not.toHaveBeenCalled();
    });

    it("returns 'needsMigration' once the cooldown of a failed attempt has expired", async () => {
      organizationsNeedingBackfill.mockResolvedValue([mockOrganizationId]);
      await stateProvider.setUserState(
        ORGANIZATION_KEY_ID_BACKFILL_COOLDOWN,
        new Date(new Date().getTime() - 25 * HOUR_MS),
        mockUserId,
      );

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("needsMigration");
    });

    it("returns 'noMigrationNeeded' when the SDK cannot evaluate the backfill", async () => {
      organizationsNeedingBackfill.mockRejectedValue(
        makeBackfillError("OrganizationStateNotAvailable", "Organization state is not available"),
      );

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockLogService.warning).toHaveBeenCalled();
    });
  });

  describe("runMigrations", () => {
    it.each([null, undefined])("throws when userId is %s", async (userId) => {
      await expect(sut.runMigrations(userId as any)).rejects.toThrow("userId");
    });

    it("records the organization key ids with the server", async () => {
      await sut.runMigrations(mockUserId);

      expect(backfill).toHaveBeenCalledTimes(1);
    });

    it("starts the cooldown when the server rejects the backfill", async () => {
      // e.g. the server holds a different key id for the organization and answers with a 409
      backfill.mockRejectedValue(
        makeBackfillError("Api", "API call failed during organization key id backfill"),
      );

      await expect(sut.runMigrations(mockUserId)).rejects.toThrow(
        "API call failed during organization key id backfill",
      );

      const cooldown = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_KEY_ID_BACKFILL_COOLDOWN).state$,
      );
      expect(cooldown).not.toBeNull();
    });

    it("does not start the cooldown when the backfill fails locally", async () => {
      backfill.mockRejectedValue(
        makeBackfillError("OrganizationStateNotAvailable", "Organization state is not available"),
      );

      await expect(sut.runMigrations(mockUserId)).rejects.toThrow(
        "Organization state is not available",
      );

      const cooldown = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_KEY_ID_BACKFILL_COOLDOWN).state$,
      );
      expect(cooldown).toBeNull();
    });
  });
});
