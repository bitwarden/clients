import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedGlobal = { theme?: string };

const THEME_SELECTION: KeyDefinitionLike = {
  key: "selection",
  stateDefinition: { name: "theming" },
};

export class MoveThemeToStateProviderMigrator extends Migrator<34, 35> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const legacyGlobalState = await helper.get<ExpectedGlobal>("global");
    const theme = legacyGlobalState?.theme;
    if (theme != null) {
      await helper.setToGlobal(THEME_SELECTION, theme);
      delete legacyGlobalState.theme;
      await helper.set("global", legacyGlobalState);
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const theme = await helper.getFromGlobal<string>(THEME_SELECTION);
    if (theme != null) {
      const legacyGlobal = (await helper.get<ExpectedGlobal>("global")) ?? {};
      legacyGlobal.theme = theme;
      await helper.set("global", legacyGlobal);
      await helper.removeFromGlobal(THEME_SELECTION);
    }
  }
}
