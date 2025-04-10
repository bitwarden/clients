// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountType = {
  profile?: {
    lastSync?: string;
  };
};

const LAST_SYNC_KEY: KeyDefinitionLike = {
  key: "lastSync",
  stateDefinition: {
    name: "sync",
  },
};

export class LastSyncMigrator extends Migrator<15, 16> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = account?.profile?.lastSync;
      await helper.setToUser(userId, LAST_SYNC_KEY, value ?? null);
      if (value != null) {
        delete account.profile.lastSync;
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }
  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();

    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = await helper.getFromUser(userId, LAST_SYNC_KEY);
      if (account) {
        account.profile = Object.assign(account.profile ?? {}, {
          lastSync: value,
        });
        await helper.set(userId, account);
      }
      await helper.setToUser(userId, LAST_SYNC_KEY, null);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
