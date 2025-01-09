// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccount = {
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

export class MoveLastSyncDate extends Migrator<67, 68> {
  async migrate(helper: MigrationHelper): Promise<void> {
    async function migrateAccount(userId: string, account: ExpectedAccount) {
      const value = account?.profile?.lastSync;
      if (value != null) {
        await helper.setToUser(userId, LAST_SYNC_KEY, value);

        delete account.profile.lastSync;
        await helper.set(userId, account);
      }
    }

    const accounts = await helper.getAccounts<ExpectedAccount>();
    await Promise.all(accounts.map(({ userId, account }) => migrateAccount(userId, account)));
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    async function rollbackAccount(userId: string, account: ExpectedAccount) {
      const value = await helper.getFromUser<string>(userId, LAST_SYNC_KEY);

      if (value != null) {
        account ??= {};
        account.profile ??= {};
        account.profile.lastSync = value;
        await helper.set(userId, account);
        await helper.removeFromUser(userId, LAST_SYNC_KEY);
      }
    }

    const accounts = await helper.getAccounts<ExpectedAccount>();
    await Promise.all(accounts.map(({ userId, account }) => rollbackAccount(userId, account)));
  }
}
