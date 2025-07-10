import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountType = {
  profile?: {
    hasPremiumPersonally?: boolean;
    hasPremiumFromOrganization?: boolean;
  };
};

type ExpectedBillingAccountProfileType = {
  hasPremiumPersonally: boolean;
  hasPremiumFromOrganization: boolean;
};

export const BILLING_ACCOUNT_PROFILE_KEY_DEFINITION: KeyDefinitionLike = {
  key: "accountProfile",
  stateDefinition: {
    name: "billing",
  },
};

export class MoveBillingAccountProfileMigrator extends Migrator<38, 39> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();

    const migrateAccount = async (userId: string, account: ExpectedAccountType): Promise<void> => {
      const hasPremiumPersonally = account?.profile?.hasPremiumPersonally;
      const hasPremiumFromOrganization = account?.profile?.hasPremiumFromOrganization;

      if (hasPremiumPersonally != null || hasPremiumFromOrganization != null) {
        await helper.setToUser(userId, BILLING_ACCOUNT_PROFILE_KEY_DEFINITION, {
          hasPremiumPersonally: hasPremiumPersonally,
          hasPremiumFromOrganization: hasPremiumFromOrganization,
        });

        delete account?.profile?.hasPremiumPersonally;
        delete account?.profile?.hasPremiumFromOrganization;
        await helper.set(userId, account);
      }
    };

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    const rollbackAccount = async (userId: string, account: ExpectedAccountType): Promise<void> => {
      const value = await helper.getFromUser<ExpectedBillingAccountProfileType>(
        userId,
        BILLING_ACCOUNT_PROFILE_KEY_DEFINITION,
      );

      if (account && value) {
        account.profile = Object.assign(account.profile ?? {}, {
          hasPremiumPersonally: value?.hasPremiumPersonally,
          hasPremiumFromOrganization: value?.hasPremiumFromOrganization,
        });
        await helper.set(userId, account);
      }

      await helper.setToUser(userId, BILLING_ACCOUNT_PROFILE_KEY_DEFINITION, null);
    };

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);
  }
}
