import { firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/logging";
import { isOrganizationKeyIdBackfillError } from "@bitwarden/sdk-internal";

import { assertNonNullish } from "../../../auth/utils";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import {
  ENCRYPTED_MIGRATION_DISK,
  StateProvider,
  UserKeyDefinition,
} from "../../../platform/state";
import { SyncService } from "../../../platform/sync";
import { UserId } from "../../../types/guid";
import { withPasswordManagerSdk } from "../../utils";

import { EncryptedMigration, MigrationRequirement } from "./encrypted-migration";

/**
 * Timestamp of the last backfill attempt that failed against the server. Servers older than the
 * one introducing the backfill endpoint answer with a 404, which would otherwise make the
 * migration retry on every scheduler tick.
 */
export const ORGANIZATION_KEY_ID_BACKFILL_COOLDOWN = new UserKeyDefinition<Date>(
  ENCRYPTED_MIGRATION_DISK,
  "organizationKeyIdBackfillCooldown",
  {
    deserializer: (obj: string) => (obj != null ? new Date(obj) : null),
    clearOn: ["logout"],
  },
);

const COOLDOWN_HOURS = 24;
const MS_PER_HOUR = 1000 * 60 * 60;

/**
 * @internal
 * Records the ids of the organization keys the server does not have, for organizations the user
 * administers.
 *
 * Requires the account to be unlocked, but never the master password: the organization keys are
 * already in memory, and only their ids - not any key material - leave the client.
 */
export class OrganizationKeyIdBackfillMigration implements EncryptedMigration {
  constructor(
    private readonly sdkService: SdkService,
    private readonly syncService: SyncService,
    private readonly stateProvider: StateProvider,
    private readonly logService: LogService,
  ) {}

  async runMigrations(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");

    this.logService.info(
      `[OrganizationKeyIdBackfillMigration] Recording the organization key ids for ${userId}`,
    );
    try {
      await withPasswordManagerSdk(userId, this.sdkService, async (sdk) => {
        await sdk.organization_crypto_management().organization_key_id_backfill();
      });
    } catch (error) {
      // Every server-side failure backs off, a 409 for a conflicting key id included: the server
      // may not support the backfill endpoint at all, and a conflict does not resolve on retry.
      // `OrganizationStateNotAvailable` is a local condition that resolves on its own.
      if (isOrganizationKeyIdBackfillError(error) && error.variant === "Api") {
        await this.startCooldown(userId);
      }
      throw error;
    }
  }

  async needsMigration(userId: UserId): Promise<MigrationRequirement> {
    assertNonNullish(userId, "userId");

    try {
      // Checked before anything else: the sync below re-triggers the scheduler, so a failing
      // migration would otherwise loop.
      if (await this.isInCooldown(userId)) {
        this.logService.info(
          `[OrganizationKeyIdBackfillMigration] Skipping migration for user ${userId}; a previous attempt failed less than ${COOLDOWN_HOURS} hours ago`,
        );
        return "noMigrationNeeded";
      }

      if (!(await this.needsBackfill(userId))) {
        return "noMigrationNeeded";
      }

      // If another device has performed the backfill, but the local device has not
      // synced recently, we want to perform a sync so that we avoid doing a second backfill.
      await this.syncService.fullSync(false);
      if (!(await this.needsBackfill(userId))) {
        this.logService.info(
          `[OrganizationKeyIdBackfillMigration] After syncing, user ${userId} does not need migration anymore. This means the migration was likely already performed on another client!`,
        );
        return "noMigrationNeeded";
      }

      return "needsMigration";
    } catch (error) {
      this.logService.warning(
        `[OrganizationKeyIdBackfillMigration] Could not determine whether user ${userId} needs migration: ${error}`,
      );
      return "noMigrationNeeded";
    }
  }

  /**
   * Whether the SDK reports any organization, administered by the user, whose key id the server
   * does not hold. This determination is based on the local state set after a sync / login.
   */
  private async needsBackfill(userId: UserId): Promise<boolean> {
    return await withPasswordManagerSdk(userId, this.sdkService, async (sdk) => {
      const organizationIds = await sdk
        .organization_crypto_management()
        .organization_key_ids_needing_backfill();
      return organizationIds.length > 0;
    });
  }

  private async isInCooldown(userId: UserId): Promise<boolean> {
    const failedAt = await firstValueFrom(
      this.stateProvider.getUser(userId, ORGANIZATION_KEY_ID_BACKFILL_COOLDOWN).state$,
    );
    if (failedAt == null) {
      return false;
    }

    const hoursSinceFailure = (new Date().getTime() - failedAt.getTime()) / MS_PER_HOUR;

    return hoursSinceFailure < COOLDOWN_HOURS;
  }

  private async startCooldown(userId: UserId): Promise<void> {
    await this.stateProvider.setUserState(
      ORGANIZATION_KEY_ID_BACKFILL_COOLDOWN,
      new Date(),
      userId,
    );
  }
}
