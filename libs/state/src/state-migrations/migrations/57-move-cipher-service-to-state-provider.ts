import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountType = {
  data: {
    localData?: unknown;
    ciphers?: {
      encrypted: unknown;
    };
  };
};

export const CIPHERS_DISK_LOCAL: KeyDefinitionLike = {
  key: "localData",
  stateDefinition: {
    name: "ciphersLocal",
  },
};

export const CIPHERS_DISK: KeyDefinitionLike = {
  key: "ciphers",
  stateDefinition: {
    name: "ciphers",
  },
};

export class CipherServiceMigrator extends Migrator<56, 57> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      let updatedAccount = false;

      //Migrate localData
      const localData = account?.data?.localData;
      if (localData != null) {
        await helper.setToUser(userId, CIPHERS_DISK_LOCAL, localData);
        delete account.data.localData;
        updatedAccount = true;
      }

      //Migrate ciphers
      const ciphers = account?.data?.ciphers?.encrypted;
      if (ciphers != null) {
        await helper.setToUser(userId, CIPHERS_DISK, ciphers);
        delete account.data.ciphers;
        updatedAccount = true;
      }

      if (updatedAccount) {
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      //rollback localData
      const localData = await helper.getFromUser(userId, CIPHERS_DISK_LOCAL);

      if (account.data && localData != null) {
        account.data.localData = localData;
        await helper.set(userId, account);
      }
      await helper.setToUser(userId, CIPHERS_DISK_LOCAL, null);

      //rollback ciphers
      const ciphers = await helper.getFromUser(userId, CIPHERS_DISK);

      if (account.data && ciphers != null) {
        account.data.ciphers ||= { encrypted: null };
        account.data.ciphers.encrypted = ciphers;
        await helper.set(userId, account);
      }
      await helper.setToUser(userId, CIPHERS_DISK, null);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
