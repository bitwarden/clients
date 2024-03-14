import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountType = {
  [cipherId: string]: LocalData;
};

type LocalData = {
  lastUsedDate?: number;
  lastLaunched?: number;
};

const CIPHERS_DISK: KeyDefinitionLike = {
  key: "ciphers_disk",
  stateDefinition: {
    name: "localData",
  },
};

export class LocalDataMigrator extends Migrator<35, 36> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = account?.localData;
      if (value != null) {
        await helper.setToUser(userId, CIPHERS_DISK, value);
        delete account.LocalData;
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = await helper.getFromUser(userId, CIPHERS_DISK);
      if (account) {
        account.localData = Object.assign(account.localData ?? {}, {
          localData: value,
        });
        await helper.set(userId, account);
      }
      await helper.setToUser(userId, CIPHERS_DISK, null);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
