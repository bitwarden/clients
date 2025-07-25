import { MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedGlobal = {
  locale?: string;
};

export const LOCALE_KEY = {
  key: "locale",
  stateDefinition: {
    name: "translation",
  },
};

export class PreferredLanguageMigrator extends Migrator<31, 32> {
  async migrate(helper: MigrationHelper): Promise<void> {
    // global state
    const global = await helper.get<ExpectedGlobal>("global");
    if (!global?.locale) {
      return;
    }

    await helper.setToGlobal(LOCALE_KEY, global.locale);
    delete global.locale;
    await helper.set("global", global);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const locale = await helper.getFromGlobal<string>(LOCALE_KEY);

    if (!locale) {
      return;
    }
    const global = (await helper.get<ExpectedGlobal>("global")) ?? {};
    global.locale = locale;
    await helper.set("global", global);
    await helper.setToGlobal(LOCALE_KEY, null);
  }
}
