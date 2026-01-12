// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type CollectionDataType = {
  id: string;
  organizationId: string;
  name: string;
  externalId: string;
  readOnly: boolean;
  manage: boolean;
  hidePasswords: boolean;
};

type ExpectedAccountType = {
  data?: {
    collections?: {
      encrypted?: Record<string, CollectionDataType>;
    };
  };
};

const USER_ENCRYPTED_COLLECTIONS: KeyDefinitionLike = {
  key: "collections",
  stateDefinition: {
    name: "collection",
  },
};

export class CollectionMigrator extends Migrator<20, 21> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();

    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = account?.data?.collections?.encrypted;
      if (value != null) {
        await helper.setToUser(userId, USER_ENCRYPTED_COLLECTIONS, value);
        delete account.data.collections;
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();

    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = await helper.getFromUser(userId, USER_ENCRYPTED_COLLECTIONS);
      if (account) {
        account.data = Object.assign(account.data ?? {}, {
          collections: {
            encrypted: value,
          },
        });

        await helper.set(userId, account);
      }
      await helper.setToUser(userId, USER_ENCRYPTED_COLLECTIONS, null);
    }
    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
