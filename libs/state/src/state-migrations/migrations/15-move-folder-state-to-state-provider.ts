// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type FolderDataType = {
  id: string;
  name: string;
  revisionDate: string;
};

type ExpectedAccountType = {
  data?: {
    folders?: {
      encrypted?: Record<string, FolderDataType>;
    };
  };
};

const USER_ENCRYPTED_FOLDERS: KeyDefinitionLike = {
  key: "folders",
  stateDefinition: {
    name: "folder",
  },
};

export class FolderMigrator extends Migrator<14, 15> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = account?.data?.folders?.encrypted;
      if (value != null) {
        await helper.setToUser(userId, USER_ENCRYPTED_FOLDERS, value);
        delete account.data.folders;
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = await helper.getFromUser(userId, USER_ENCRYPTED_FOLDERS);
      if (account) {
        account.data = Object.assign(account.data ?? {}, {
          folders: {
            encrypted: value,
          },
        });
        await helper.set(userId, account);
      }
      await helper.setToUser(userId, USER_ENCRYPTED_FOLDERS, null);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
