import { UserId } from "../../types/guid";

import { MigrationRequirement } from "./migrations/encrypted-migration";

export abstract class EncryptedMigrator {
  /**
   * Runs migrations on a decrypted user, with the cryptographic state initialized.
   * This only runs the migrations that are needed for the user.
   * This needs to be run after the decrypted user key has been set to state.
   *
   * If the master password is required but not provided, the migrations will not run, and the function will return early.
   * If migrations are already running, the migrations will not run again, and the function will return early.
   *
   * @param userId The ID of the user to run migrations for.
   * @param masterPassword The user's current master password.
   * @throws If the user does not exist
   * @throws If the user is locked or logged out
   * @throws If a migration fails
   */
  abstract runMigrations(userId: UserId, masterPassword: string | null): Promise<void>;
  /**
   * Checks if the user needs to run any migrations.
   * This is used to determine if the user should be prompted to run migrations.
   * @param userId The ID of the user to check migrations for.
   */
  abstract needsMigrations(userId: UserId): Promise<MigrationRequirement>;

  /**
   * Indicates whether migrations are currently running.
   */
  abstract isRunningMigrations(): boolean;
}
