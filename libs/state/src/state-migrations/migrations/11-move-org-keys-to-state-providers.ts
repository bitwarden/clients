// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type OrgKeyDataType = {
  type: "organization" | "provider";
  key: string;
  providerId?: string;
};

type ExpectedAccountType = {
  keys?: {
    organizationKeys?: {
      encrypted?: Record<string, OrgKeyDataType>;
    };
  };
};

const USER_ENCRYPTED_ORGANIZATION_KEYS: KeyDefinitionLike = {
  key: "organizationKeys",
  stateDefinition: {
    name: "crypto",
  },
};

export class OrganizationKeyMigrator extends Migrator<10, 11> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = account?.keys?.organizationKeys?.encrypted;
      if (value != null) {
        await helper.setToUser(userId, USER_ENCRYPTED_ORGANIZATION_KEYS, value);
        delete account.keys.organizationKeys;
        await helper.set(userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }
  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = await helper.getFromUser<Record<string, OrgKeyDataType>>(
        userId,
        USER_ENCRYPTED_ORGANIZATION_KEYS,
      );
      if (account && value) {
        account.keys = Object.assign(account.keys ?? {}, {
          organizationKeys: {
            encrypted: value,
          },
        });
        await helper.set(userId, account);
      }
      await helper.setToUser(userId, USER_ENCRYPTED_ORGANIZATION_KEYS, null);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
