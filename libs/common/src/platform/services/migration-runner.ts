import { CURRENT_VERSION, currentVersion, MigrationHelper } from "@bitwarden/state";

import { ClientType } from "../../enums";
import { waitForMigrations } from "../../state-migrations";
import { LogService } from "../abstractions/log.service";
import { AbstractStorageService } from "../abstractions/storage.service";

import { MigrationBuilderService } from "./migration-builder.service";

export class MigrationRunner {
  constructor(
    protected diskStorage: AbstractStorageService,
    protected logService: LogService,
    protected migrationBuilderService: MigrationBuilderService,
    private clientType: ClientType,
  ) {}

  async run(): Promise<void> {
    const migrationHelper = new MigrationHelper(
      await currentVersion(this.diskStorage, this.logService),
      this.diskStorage,
      this.logService,
      "general",
      this.clientType,
    );

    if (migrationHelper.currentVersion < 0) {
      // Cannot determine state, assuming empty so we don't repeatedly apply a migration.
      await this.diskStorage.save("stateVersion", CURRENT_VERSION);
      return;
    }

    const migrationBuilder = this.migrationBuilderService.build();

    await migrationBuilder.migrate(migrationHelper);
  }

  async waitForCompletion(): Promise<void> {
    await waitForMigrations(this.diskStorage, this.logService);
  }
}
