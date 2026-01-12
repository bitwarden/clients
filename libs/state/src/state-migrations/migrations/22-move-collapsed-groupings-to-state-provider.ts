// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountType = {
  settings?: {
    collapsedGroupings?: string[];
  };
};

const COLLAPSED_GROUPINGS: KeyDefinitionLike = {
  key: "collapsedGroupings",
  stateDefinition: {
    name: "vaultFilter",
  },
};

export class CollapsedGroupingsMigrator extends Migrator<21, 22> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = account?.settings?.collapsedGroupings;
      if (value != null) {
        await helper.setToUser(userId, COLLAPSED_GROUPINGS, value);
        delete account.settings.collapsedGroupings;
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = await helper.getFromUser(userId, COLLAPSED_GROUPINGS);
      if (account) {
        account.settings = Object.assign(account.settings ?? {}, {
          collapsedGroupings: value,
        });
        await helper.set(userId, account);
      }
      await helper.setToUser(userId, COLLAPSED_GROUPINGS, null);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
