import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedGlobalState = {
  disableFavicon?: boolean;
};

const ShowFaviconDefinition: KeyDefinitionLike = {
  stateDefinition: {
    name: "domainSettings",
  },
  key: "showFavicons",
};

export class EnableFaviconMigrator extends Migrator<41, 42> {
  async migrate(helper: MigrationHelper): Promise<void> {
    // global state ("disableFavicon" -> "showFavicons")
    const globalState = await helper.get<ExpectedGlobalState>("global");

    if (globalState?.disableFavicon != null) {
      await helper.setToGlobal(ShowFaviconDefinition, !globalState.disableFavicon);

      // delete `disableFavicon` from state global
      delete globalState.disableFavicon;

      await helper.set<ExpectedGlobalState>("global", globalState);
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    // global state ("showFavicons" -> "disableFavicon")
    const globalState = (await helper.get<ExpectedGlobalState>("global")) || {};
    const showFavicons: boolean = await helper.getFromGlobal(ShowFaviconDefinition);

    if (showFavicons != null) {
      await helper.set<ExpectedGlobalState>("global", {
        ...globalState,
        disableFavicon: !showFavicons,
      });

      // remove the global state provider framework key for `showFavicons`
      await helper.setToGlobal(ShowFaviconDefinition, null);
    }
  }
}
