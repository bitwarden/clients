import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

export const ACCOUNT_ACCOUNTS: KeyDefinitionLike = {
  stateDefinition: {
    name: "account",
  },
  key: "accounts",
};

export const ACCOUNT_ACTIVE_ACCOUNT_ID: KeyDefinitionLike = {
  stateDefinition: {
    name: "account",
  },
  key: "activeAccountId",
};

export const ACCOUNT_ACTIVITY: KeyDefinitionLike = {
  stateDefinition: {
    name: "account",
  },
  key: "activity",
};

type ExpectedAccountType = {
  profile?: {
    email?: string;
    name?: string;
    emailVerified?: boolean;
  };
};

export class KnownAccountsMigrator extends Migrator<59, 60> {
  async migrate(helper: MigrationHelper): Promise<void> {
    await this.migrateAuthenticatedAccounts(helper);
    await this.migrateActiveAccountId(helper);
    await this.migrateAccountActivity(helper);
  }
  async rollback(helper: MigrationHelper): Promise<void> {
    // authenticated account are removed, but the accounts record also contains logged out accounts. Best we can do is to add them all back
    const userIds = (await helper.getKnownUserIds()) ?? [];
    await helper.set("authenticatedAccounts", userIds);
    await helper.removeFromGlobal(ACCOUNT_ACCOUNTS);

    // Active Account Id
    const activeAccountId = await helper.getFromGlobal<string>(ACCOUNT_ACTIVE_ACCOUNT_ID);
    if (activeAccountId) {
      await helper.set("activeUserId", activeAccountId);
    }
    await helper.removeFromGlobal(ACCOUNT_ACTIVE_ACCOUNT_ID);

    // Account Activity
    const accountActivity = await helper.getFromGlobal<Record<string, string>>(ACCOUNT_ACTIVITY);
    if (accountActivity) {
      const toStore = Object.entries(accountActivity).reduce(
        (agg, [userId, dateString]) => {
          agg[userId] = new Date(dateString).getTime();
          return agg;
        },
        {} as Record<string, number>,
      );
      await helper.set("accountActivity", toStore);
    }
    await helper.removeFromGlobal(ACCOUNT_ACTIVITY);
  }

  private async migrateAuthenticatedAccounts(helper: MigrationHelper) {
    const authenticatedAccounts = (await helper.get<string[]>("authenticatedAccounts")) ?? [];
    const accounts = await Promise.all(
      authenticatedAccounts.map(async (userId) => {
        const account = await helper.get<ExpectedAccountType>(userId);
        return { userId, account };
      }),
    );
    const accountsToStore = accounts.reduce(
      (agg, { userId, account }) => {
        if (account?.profile) {
          agg[userId] = {
            email: account.profile.email ?? "",
            emailVerified: account.profile.emailVerified ?? false,
            name: account.profile.name,
          };
        }
        return agg;
      },
      {} as Record<string, { email: string; emailVerified: boolean; name: string | undefined }>,
    );

    await helper.setToGlobal(ACCOUNT_ACCOUNTS, accountsToStore);
    await helper.remove("authenticatedAccounts");
  }

  private async migrateAccountActivity(helper: MigrationHelper) {
    const stored = await helper.get<Record<string, Date>>("accountActivity");
    const accountActivity = Object.entries(stored ?? {}).reduce(
      (agg, [userId, dateMs]) => {
        agg[userId] = JSON.stringify(new Date(dateMs));
        return agg;
      },
      {} as Record<string, string>,
    );
    await helper.setToGlobal(ACCOUNT_ACTIVITY, accountActivity);
    await helper.remove("accountActivity");
  }

  private async migrateActiveAccountId(helper: MigrationHelper) {
    const activeAccountId = await helper.get<string>("activeUserId");
    await helper.setToGlobal(ACCOUNT_ACTIVE_ACCOUNT_ID, activeAccountId);
    await helper.remove("activeUserId");
  }
}
