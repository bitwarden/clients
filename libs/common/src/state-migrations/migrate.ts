// eslint-disable-next-line import/no-restricted-paths -- Needed to print log messages
import { LogService } from "../platform/abstractions/log.service";
// eslint-disable-next-line import/no-restricted-paths -- Needed to interface with storage locations
import { AbstractStorageService } from "../platform/abstractions/storage.service";

import { MigrationBuilder } from "./migration-builder";
import { MigrationHelper } from "./migration-helper";
import { FixPremiumMigrator } from "./migrations/3-fix-premium";
import { RemoveEverBeenUnlockedMigrator } from "./migrations/4-remove-ever-been-unlocked";
import { AddKeyTypeToOrgKeysMigrator } from "./migrations/5-add-key-type-to-org-keys";
import { RemoveLegacyEtmKeyMigrator } from "./migrations/6-remove-legacy-etm-key";
import { MoveBiometricAutoPromptToAccount } from "./migrations/7-move-biometric-auto-prompt-to-account";
import { MoveStateVersionMigrator } from "./migrations/8-move-state-version";
import { MinVersionMigrator } from "./migrations/min-version";

export const MIN_VERSION = 2;
export const CURRENT_VERSION = 8;
export type MinVersion = typeof MIN_VERSION;

export async function migrate(
  storageService: AbstractStorageService,
  logService: LogService
): Promise<void> {
  const migrationHelper = new MigrationHelper(
    await currentVersion(storageService, logService),
    storageService,
    logService
  );
  if (migrationHelper.currentVersion < 0) {
    // Cannot determine state, assuming empty so we don't repeatedly apply a migration.
    await storageService.save("stateVersion", CURRENT_VERSION);
    return;
  }
  MigrationBuilder.create()
    .with(MinVersionMigrator)
    .with(FixPremiumMigrator, 2, 3)
    .with(RemoveEverBeenUnlockedMigrator, 3, 4)
    .with(AddKeyTypeToOrgKeysMigrator, 4, 5)
    .with(RemoveLegacyEtmKeyMigrator, 5, 6)
    .with(MoveBiometricAutoPromptToAccount, 6, 7)
    .with(MoveStateVersionMigrator, 7, CURRENT_VERSION)
    .migrate(migrationHelper);
}

export async function currentVersion(
  storageService: AbstractStorageService,
  logService: LogService
) {
  let state = await storageService.get<number>("stateVersion");
  if (state == null) {
    // Pre v8
    state = (await storageService.get<{ stateVersion: number }>("global"))?.stateVersion;
  }
  if (state == null) {
    logService.info("No state version found, assuming empty state.");
    return -1;
  }
  logService.info(`State version: ${state}`);
  return state;
}
