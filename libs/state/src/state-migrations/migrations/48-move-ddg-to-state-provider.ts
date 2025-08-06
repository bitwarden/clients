import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedGlobal = {
  enableDuckDuckGoBrowserIntegration?: boolean;
};

export const DDG_KEY: KeyDefinitionLike = {
  key: "enableDuckDuckGoBrowserIntegration",
  stateDefinition: {
    name: "autofillSettings",
  },
};

export class MoveDdgToStateProviderMigrator extends Migrator<47, 48> {
  async migrate(helper: MigrationHelper): Promise<void> {
    // global state
    const global = await helper.get<ExpectedGlobal>("global");
    if (global?.enableDuckDuckGoBrowserIntegration == null) {
      return;
    }

    await helper.setToGlobal(DDG_KEY, global.enableDuckDuckGoBrowserIntegration);
    delete global.enableDuckDuckGoBrowserIntegration;
    await helper.set("global", global);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const enableDdg = await helper.getFromGlobal<boolean>(DDG_KEY);

    if (!enableDdg) {
      return;
    }

    const global = (await helper.get<ExpectedGlobal>("global")) ?? {};
    global.enableDuckDuckGoBrowserIntegration = enableDdg;
    await helper.set("global", global);
    await helper.removeFromGlobal(DDG_KEY);
  }
}
