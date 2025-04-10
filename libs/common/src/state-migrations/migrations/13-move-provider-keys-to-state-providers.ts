// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountType = {
  keys?: {
    providerKeys?: {
      encrypted?: Record<string, string>; // Record<ProviderId, EncryptedString> where EncryptedString is the ProviderKey encrypted by the UserKey.
    };
  };
};

const USER_ENCRYPTED_PROVIDER_KEYS: KeyDefinitionLike = {
  key: "providerKeys",
  stateDefinition: {
    name: "crypto",
  },
};

export class ProviderKeyMigrator extends Migrator<12, 13> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = account?.keys?.providerKeys?.encrypted;
      if (value != null) {
        await helper.setToUser(userId, USER_ENCRYPTED_PROVIDER_KEYS, value);
        delete account.keys.providerKeys;
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
        USER_ENCRYPTED_PROVIDER_KEYS,
      );
      if (account && value) {
        account.keys = Object.assign(account.keys ?? {}, {
          providerKeys: {
            encrypted: value,
          },
        });
        await helper.set(userId, account);
      }
      await helper.setToUser(userId, USER_ENCRYPTED_PROVIDER_KEYS, null);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
