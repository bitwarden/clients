import { KeyDefinitionLike, MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

const DESKTOP_SETTINGS_STATE: StateDefinitionLike = { name: "desktopSettings" };

const BROWSER_INTEGRATION_ENABLED_KEY: KeyDefinitionLike = {
  key: "browserIntegrationEnabled",
  stateDefinition: DESKTOP_SETTINGS_STATE,
};

/**
 * Removes the now-unused `browserIntegrationEnabled` desktop setting. Browser integration is always
 * enabled, so the persisted value is orphaned and is removed here.
 */
export class RemoveBrowserIntegrationEnabled extends Migrator<81, 82> {
  async migrate(helper: MigrationHelper): Promise<void> {
    if ((await helper.getFromGlobal<boolean>(BROWSER_INTEGRATION_ENABLED_KEY)) != null) {
      await helper.removeFromGlobal(BROWSER_INTEGRATION_ENABLED_KEY);
    }
  }

  rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
