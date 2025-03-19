// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountState = {
  data?: {
    eventCollection?: [];
  };
};

const EVENT_COLLECTION: KeyDefinitionLike = {
  stateDefinition: {
    name: "eventCollection",
  },
  key: "eventCollection",
};

export class EventCollectionMigrator extends Migrator<40, 41> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountState>();

    async function migrateAccount(userId: string, account: ExpectedAccountState): Promise<void> {
      const value = account?.data?.eventCollection;
      if (value != null) {
        await helper.setToUser(userId, EVENT_COLLECTION, value);
        delete account.data.eventCollection;
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountState>();

    async function rollbackAccount(userId: string, account: ExpectedAccountState): Promise<void> {
      const value = await helper.getFromUser(userId, EVENT_COLLECTION);
      if (account) {
        account.data = Object.assign(account.data ?? {}, {
          eventCollection: value,
        });

        await helper.set(userId, account);
      }
      await helper.setToUser(userId, EVENT_COLLECTION, null);
    }
    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
