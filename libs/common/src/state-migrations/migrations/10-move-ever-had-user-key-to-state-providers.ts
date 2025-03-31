// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountType = {
  profile?: {
    everHadUserKey?: boolean;
  };
};

const USER_EVER_HAD_USER_KEY: KeyDefinitionLike = {
  key: "everHadUserKey",
  stateDefinition: {
    name: "crypto",
  },
};

export class EverHadUserKeyMigrator extends Migrator<9, 10> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = account?.profile?.everHadUserKey;
      await helper.setToUser(userId, USER_EVER_HAD_USER_KEY, value ?? false);
      if (value != null) {
        delete account.profile.everHadUserKey;
      }
      await helper.set(userId, account);
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }
  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = await helper.getFromUser(userId, USER_EVER_HAD_USER_KEY);
      if (account) {
        account.profile = Object.assign(account.profile ?? {}, {
          everHadUserKey: value,
        });
        await helper.set(userId, account);
      }
      await helper.setToUser(userId, USER_EVER_HAD_USER_KEY, null);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
