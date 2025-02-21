// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

enum ProviderUserStatusType {
  Invited = 0,
  Accepted = 1,
  Confirmed = 2,
  Revoked = -1,
}

enum ProviderUserType {
  ProviderAdmin = 0,
  ServiceUser = 1,
}

type ProviderData = {
  id: string;
  name: string;
  status: ProviderUserStatusType;
  type: ProviderUserType;
  enabled: boolean;
  userId: string;
  useEvents: boolean;
};

type ExpectedAccountType = {
  data?: {
    providers?: Record<string, Jsonify<ProviderData>>;
  };
};

const USER_PROVIDERS: KeyDefinitionLike = {
  key: "providers",
  stateDefinition: {
    name: "providers",
  },
};

export class ProviderMigrator extends Migrator<27, 28> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = account?.data?.providers;
      if (value != null) {
        await helper.setToUser(userId, USER_PROVIDERS, value);
        delete account.data.providers;
        await helper.set(userId, account);
      }
    }

    await Promise.all(accounts.map(({ userId, account }) => migrateAccount(userId, account)));
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = await helper.getFromUser(userId, USER_PROVIDERS);
      if (account) {
        account.data = Object.assign(account.data ?? {}, {
          providers: value,
        });
        await helper.set(userId, account);
      }
      await helper.setToUser(userId, USER_PROVIDERS, null);
    }

    await Promise.all(accounts.map(({ userId, account }) => rollbackAccount(userId, account)));
  }
}
