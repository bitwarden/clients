import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedGlobalType = {
  enablePasskeys?: boolean;
};

const USER_ENABLE_PASSKEYS: KeyDefinitionLike = {
  key: "enablePasskeys",
  stateDefinition: {
    name: "vaultSettings",
  },
};

export class EnablePasskeysMigrator extends Migrator<16, 17> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const global = await helper.get<ExpectedGlobalType>("global");

    if (global?.enablePasskeys != null) {
      await helper.setToGlobal(USER_ENABLE_PASSKEYS, global.enablePasskeys);
      delete global?.enablePasskeys;
      await helper.set("global", global);
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    let global = await helper.get<ExpectedGlobalType>("global");
    const globalEnablePasskeys = await helper.getFromGlobal<boolean>(USER_ENABLE_PASSKEYS);

    if (globalEnablePasskeys != null) {
      global = Object.assign(global ?? {}, { enablePasskeys: globalEnablePasskeys });
      await helper.set("global", global);
      await helper.setToGlobal(USER_ENABLE_PASSKEYS, undefined);
    }
  }
}
