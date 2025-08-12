import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedGlobalState = {
  disableContextMenuItem?: boolean;
};

const enableContextMenuKeyDefinition: KeyDefinitionLike = {
  stateDefinition: {
    name: "autofillSettings",
  },
  key: "enableContextMenu",
};

export class EnableContextMenuMigrator extends Migrator<30, 31> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const globalState = await helper.get<ExpectedGlobalState>("global");

    // disableContextMenuItem -> enableContextMenu
    if (globalState?.disableContextMenuItem != null) {
      await helper.setToGlobal(enableContextMenuKeyDefinition, !globalState.disableContextMenuItem);

      // delete `disableContextMenuItem` from state global
      delete globalState.disableContextMenuItem;

      await helper.set<ExpectedGlobalState>("global", globalState);
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const globalState = (await helper.get<ExpectedGlobalState>("global")) || {};

    const enableContextMenu: boolean = await helper.getFromGlobal(enableContextMenuKeyDefinition);

    // enableContextMenu -> disableContextMenuItem
    if (enableContextMenu != null) {
      await helper.set<ExpectedGlobalState>("global", {
        ...globalState,
        disableContextMenuItem: !enableContextMenu,
      });

      // remove the global state provider framework key for `enableContextMenu`
      await helper.setToGlobal(enableContextMenuKeyDefinition, null);
    }
  }
}
