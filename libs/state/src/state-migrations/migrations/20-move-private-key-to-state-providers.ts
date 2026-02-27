// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountType = {
  keys?: {
    privateKey?: {
      encrypted?: string; // EncryptedString
    };
  };
};

const USER_ENCRYPTED_PRIVATE_KEY: KeyDefinitionLike = {
  key: "privateKey",
  stateDefinition: {
    name: "crypto",
  },
};

export class PrivateKeyMigrator extends Migrator<19, 20> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = account?.keys?.privateKey?.encrypted;
      if (value != null) {
        await helper.setToUser(userId, USER_ENCRYPTED_PRIVATE_KEY, value);
        delete account.keys.privateKey;
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }
  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = await helper.getFromUser<Record<string, string>>(
        userId,
        USER_ENCRYPTED_PRIVATE_KEY,
      );
      if (account && value) {
        account.keys = Object.assign(account.keys ?? {}, {
          privateKey: {
            encrypted: value,
          },
        });
        await helper.set(userId, account);
      }
      await helper.setToUser(userId, USER_ENCRYPTED_PRIVATE_KEY, null);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
