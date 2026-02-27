import { KeyDefinitionLike, MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { Migrator } from "../migrator";

const CONFIG_DISK: StateDefinitionLike = { name: "config" };
export const USER_SERVER_CONFIG: KeyDefinitionLike = {
  stateDefinition: CONFIG_DISK,
  key: "serverConfig",
};

// Note: no need to migrate global configs, they don't currently exist

type ExpectedAccountType = {
  settings?: {
    serverConfig?: unknown;
  };
};

export class AccountServerConfigMigrator extends Migrator<48, 49> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();

    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      if (account?.settings?.serverConfig != null) {
        await helper.setToUser(userId, USER_SERVER_CONFIG, account.settings.serverConfig);
        delete account.settings.serverConfig;
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();

    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const serverConfig = await helper.getFromUser(userId, USER_SERVER_CONFIG);

      if (serverConfig) {
        account ??= {};
        account.settings ??= {};

        account.settings.serverConfig = serverConfig;
        await helper.setToUser(userId, USER_SERVER_CONFIG, null);
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
