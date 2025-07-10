// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type DecryptionOptionsType = {
  hasMasterPassword: boolean;
  trustedDeviceOption?: {
    hasAdminApproval: boolean;
    hasLoginApprovingDevice: boolean;
    hasManageResetPasswordPermission: boolean;
  };
  keyConnectorOption?: {
    keyConnectorUrl: string;
  };
};

type ExpectedAccountType = {
  decryptionOptions?: DecryptionOptionsType;
};

const USER_DECRYPTION_OPTIONS: KeyDefinitionLike = {
  key: "decryptionOptions",
  stateDefinition: {
    name: "userDecryptionOptions",
  },
};

export class UserDecryptionOptionsMigrator extends Migrator<43, 44> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = account?.decryptionOptions;
      if (value != null) {
        await helper.setToUser(userId, USER_DECRYPTION_OPTIONS, value);
        delete account.decryptionOptions;
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }
  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value: DecryptionOptionsType = await helper.getFromUser(
        userId,
        USER_DECRYPTION_OPTIONS,
      );
      if (account) {
        account.decryptionOptions = Object.assign(account.decryptionOptions, value);
        await helper.set(userId, account);
      }
      await helper.setToUser(userId, USER_DECRYPTION_OPTIONS, null);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
