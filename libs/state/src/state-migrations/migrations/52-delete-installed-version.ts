import { MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

type ExpectedGlobal = {
  installedVersion?: string;
};

export class DeleteInstalledVersion extends Migrator<51, 52> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const legacyGlobal = await helper.get<ExpectedGlobal>("global");
    if (legacyGlobal?.installedVersion != null) {
      delete legacyGlobal.installedVersion;
      await helper.set("global", legacyGlobal);
    }
  }
  rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
