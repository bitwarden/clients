import { UserId } from "../../../types/guid";

/**
 * @internal
 * IMPORTANT: Please read this when implementing new migrations.
 *
 * An encrypted migration defines an online migration that mutates the persistent state of the user on the server, or locally.
 * It should only be run once per user (or for local migrations, once per device). Migrations get scheduled automatically,
 * during actions such as login and unlock, or during sync.
 *
 * Migrations can require the master-password, which is provided by the user if required.
 * Migrations are run as soon as possible non-lazily, and MAY block unlock / login, if they have to run.
 *
 * Most importantly, implementing a migration should be done such that concurrent migrations may fail, but must never
 * leave the user in a broken state. Locally, these are scheduled with an application-global lock. However, no such guarantees
 * are made for the server, and other devices may run the migration concurrently.
 *
 * When adding a migration, it *MUST* be feature-flagged for the initial roll-out.
 */
export interface EncryptedMigration {
  /**
   * Runs the migration.
   * @throws If the migration fails, such as when no network is available.
   * @throws If the requirements for migration are not met (e.g. the user is locked)
   */
  runMigrations(userId: UserId, masterPassword: string | null): Promise<void>;
  /**
   * Returns whether the migration needs to be run for the user, and if it does, whether the master password is required.
   */
  needsMigration(userId: UserId): Promise<MigrationRequirement>;
}

export type MigrationRequirement =
  | "needsMigration"
  | "needsMigrationWithMasterPassword"
  | "noMigrationNeeded";
