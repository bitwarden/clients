import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
// eslint-disable-next-line
import {
  BiometricStateService,
  BiometricsService,
  KdfConfigService,
  KeyService,
} from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { assertNonNullish } from "../../auth/utils";
import { ClientType } from "../../enums";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { SyncService } from "../../platform/sync";
import { UserId } from "../../types/guid";
import { ChangeKdfService } from "../kdf/change-kdf.service.abstraction";
import { MasterPasswordServiceAbstraction } from "../master-password/abstractions/master-password.service.abstraction";

import { EncryptedMigrator } from "./encrypted-migrator.abstraction";
import { BiometricPersistentMigration } from "./migrations/biometric-persistent-encryption-migration";
import { EncryptedMigration, MigrationRequirement } from "./migrations/encrypted-migration";
import { MinimumKdfMigration } from "./migrations/minimum-kdf-migration";

export class DefaultEncryptedMigrator implements EncryptedMigrator {
  private migrations: { name: string; migration: EncryptedMigration }[] = [];
  private isRunningMigration = false;

  constructor(
    kdfConfigService: KdfConfigService,
    changeKdfService: ChangeKdfService,
    private readonly logService: LogService,
    configService: ConfigService,
    masterPasswordService: MasterPasswordServiceAbstraction,
    private readonly syncService: SyncService,
    keyService: KeyService,
    biometricsService: BiometricsService,
    biometricStateService: BiometricStateService,
    platformUtilsService: PlatformUtilsService,
    sdkService: SdkService,
  ) {
    // Register migrations here
    this.migrations.push({
      name: "Minimum PBKDF2 Iteration Count Migration",
      migration: new MinimumKdfMigration(
        kdfConfigService,
        changeKdfService,
        logService,
        configService,
        masterPasswordService,
        syncService,
      ),
    });

    // Biometric persistent encryption is only relevant on desktop
    if (platformUtilsService.getClientType() === ClientType.Desktop) {
      this.migrations.push({
        name: "Biometric V2 Encryption Migration",
        migration: new BiometricPersistentMigration(
          keyService,
          biometricsService,
          biometricStateService,
          logService,
          sdkService,
        ),
      });
    }
  }

  async runMigrations(userId: UserId, masterPassword: string | null): Promise<void> {
    assertNonNullish(userId, "userId");

    // Ensure that the requirements for running all migrations are met
    const needsMigration = await this.needsMigrations(userId);
    if (needsMigration === "noMigrationNeeded") {
      return;
    } else if (needsMigration === "needsMigrationWithMasterPassword" && masterPassword == null) {
      // If a migration needs a password, but none is provided, the migrations are skipped. If a manual caller
      // during a login / unlock flow calls without a master password in a login / unlock strategy that has no
      // password, such as biometric unlock, the migrations are skipped.
      //
      // The fallback to this, the encrypted migrations scheduler, will first check if a migration needs a password
      // and then prompt the user. If the user enters their password, runMigrations is called again with the password.
      return;
    }

    try {
      // No concurrent migrations allowed, so acquire a service-wide lock
      if (this.isRunningMigration) {
        return;
      }
      this.isRunningMigration = true;

      // Run all migrations sequentially in the order they were registered
      this.logService.mark("[Encrypted Migrator] Start");
      this.logService.info(`[Encrypted Migrator] Starting migrations for user: ${userId}`);
      let ranMigration = false;
      for (const { name, migration } of this.migrations) {
        if ((await migration.needsMigration(userId)) !== "noMigrationNeeded") {
          this.logService.info(`[Encrypted Migrator] Running migration: ${name}`);
          const start = performance.now();
          await migration.runMigrations(userId, masterPassword);
          this.logService.measure(start, "[Encrypted Migrator]", name, "ExecutionTime");
          ranMigration = true;
        }
      }
      this.logService.mark("[Encrypted Migrator] Finish");
      this.logService.info(`[Encrypted Migrator] Completed migrations for user: ${userId}`);
      if (ranMigration) {
        await this.syncService.fullSync(true);
      }
    } catch (error) {
      this.logService.error(
        `[Encrypted Migrator] Error running migrations for user: ${userId}`,
        error,
      );
      throw error; // Re-throw the error to be handled by the caller
    } finally {
      this.isRunningMigration = false;
    }
  }

  async needsMigrations(userId: UserId): Promise<MigrationRequirement> {
    assertNonNullish(userId, "userId");

    const migrationRequirements = await Promise.all(
      this.migrations.map(async ({ migration }) => migration.needsMigration(userId)),
    );

    if (migrationRequirements.includes("needsMigrationWithMasterPassword")) {
      return "needsMigrationWithMasterPassword";
    } else if (migrationRequirements.includes("needsMigration")) {
      return "needsMigration";
    } else {
      return "noMigrationNeeded";
    }
  }

  isRunningMigrations(): boolean {
    return this.isRunningMigration;
  }
}
