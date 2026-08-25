import { LogService } from "@bitwarden/logging";

import { assertNonNullish } from "../../../auth/utils";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { SyncService } from "../../../platform/sync";
import { UserId } from "../../../types/guid";
import { withPasswordManagerSdk } from "../../utils";

import { EncryptedMigration, MigrationRequirement } from "./encrypted-migration";

/**
 * @internal
 * Records the id of the user's current UserKey with the server.
 *
 * Requires the account to be unlocked, but never the master password: the UserKey is already in
 * memory, and only its id - not any key material - leaves the client.
 */
export class UserKeyIdBackfillMigration implements EncryptedMigration {
  constructor(
    private readonly sdkService: SdkService,
    private readonly syncService: SyncService,
    private readonly logService: LogService,
  ) {}

  async runMigrations(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");

    this.logService.info(`[UserKeyIdBackfillMigration] Recording the user key id for ${userId}`);
    await withPasswordManagerSdk(userId, this.sdkService, async (sdk) => {
      await sdk.user_crypto_management().user_key_id_backfill();
    });
  }

  async needsMigration(userId: UserId): Promise<MigrationRequirement> {
    assertNonNullish(userId, "userId");

    try {
      if (!(await this.needsBackfill(userId))) {
        return "noMigrationNeeded";
      }

      // If another device has performed the backfill, but the local device has not
      // synced recently, we want to perform a sync so that we avoid doing a second backfill.
      await this.syncService.fullSync(false);
      if (!(await this.needsBackfill(userId))) {
        this.logService.info(
          `[UserKeyIdBackfillMigration] After syncing, user ${userId} does not need migration anymore. This means the migration was likely already performed on another client!`,
        );
        return "noMigrationNeeded";
      }

      return "needsMigration";
    } catch (error) {
      this.logService.warning(
        `[UserKeyIdBackfillMigration] Could not determine whether user ${userId} needs migration: ${error}`,
      );
      return "noMigrationNeeded";
    }
  }

  /**
   * Whether the SDK reports that the server holds no id for the current UserKey. This
   * determination is based on the local state set after a sync / login.
   */
  private async needsBackfill(userId: UserId): Promise<boolean> {
    return await withPasswordManagerSdk(
      userId,
      this.sdkService,
      async (sdk) => await sdk.user_crypto_management().user_key_id_needs_backfill(),
    );
  }
}
