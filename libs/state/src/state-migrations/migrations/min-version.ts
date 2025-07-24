import { MinVersion, MIN_VERSION } from "../migrate";
import { MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

export function minVersionError(current: number) {
  return `Your local data is too old to be migrated. Your current state version is ${current}, but minimum version is ${MIN_VERSION}.`;
}

export class MinVersionMigrator extends Migrator<0, MinVersion> {
  constructor() {
    super(0, MIN_VERSION);
  }

  // Overrides the default implementation to catch any version that may be passed in.
  override shouldMigrate(helper: MigrationHelper): Promise<boolean> {
    return Promise.resolve(helper.currentVersion < MIN_VERSION);
  }
  async migrate(helper: MigrationHelper): Promise<void> {
    if (helper.currentVersion < MIN_VERSION) {
      throw new Error(minVersionError(helper.currentVersion));
    }
  }
  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
