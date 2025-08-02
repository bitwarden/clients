// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

/** settings targeted by migrator */
export type AccountType = {
  data?: {
    passwordGenerationHistory?: {
      encrypted: EncryptedHistory;
    };
  };
};

/** the actual data stored in the history is opaque to the migrator */
export type EncryptedHistory = Array<unknown>;

export const HISTORY: KeyDefinitionLike = {
  stateDefinition: {
    name: "generator",
  },
  key: "localGeneratorHistoryBuffer",
};

export class GeneratorHistoryMigrator extends Migrator<63, 64> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<AccountType>();

    async function migrateAccount(userId: string, account: AccountType) {
      const data = account?.data?.passwordGenerationHistory;
      if (data && data.encrypted) {
        await helper.setToUser(userId, HISTORY, data.encrypted);
        delete account.data.passwordGenerationHistory;
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    // not supported
  }
}
