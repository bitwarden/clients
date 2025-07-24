import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

export const APP_ID_STORAGE_KEY = "appId";
export const ANONYMOUS_APP_ID_STORAGE_KEY = "anonymousAppId";

export const APP_ID_KEY: KeyDefinitionLike = {
  key: APP_ID_STORAGE_KEY,
  stateDefinition: { name: "applicationId" },
};

export const ANONYMOUS_APP_ID_KEY: KeyDefinitionLike = {
  key: ANONYMOUS_APP_ID_STORAGE_KEY,
  stateDefinition: { name: "applicationId" },
};

export class AppIdMigrator extends Migrator<32, 33> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const appId = await helper.get<string>(APP_ID_STORAGE_KEY);
    const anonymousAppId = await helper.get<string>(ANONYMOUS_APP_ID_STORAGE_KEY);

    if (appId != null) {
      await helper.setToGlobal(APP_ID_KEY, appId);
      await helper.set(APP_ID_STORAGE_KEY, null);
    }

    if (anonymousAppId != null) {
      await helper.setToGlobal(ANONYMOUS_APP_ID_KEY, anonymousAppId);
      await helper.set(ANONYMOUS_APP_ID_STORAGE_KEY, null);
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const appId = await helper.getFromGlobal<string>(APP_ID_KEY);
    const anonymousAppId = await helper.getFromGlobal<string>(ANONYMOUS_APP_ID_KEY);

    if (appId != null) {
      await helper.set(APP_ID_STORAGE_KEY, appId);
      await helper.setToGlobal(APP_ID_KEY, null);
    }
    if (anonymousAppId != null) {
      await helper.set(ANONYMOUS_APP_ID_STORAGE_KEY, anonymousAppId);
      await helper.setToGlobal(ANONYMOUS_APP_ID_KEY, null);
    }
  }
}
