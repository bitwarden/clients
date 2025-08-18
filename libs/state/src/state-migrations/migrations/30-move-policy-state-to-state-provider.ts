// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
enum PolicyType {
  TwoFactorAuthentication = 0, // Requires users to have 2fa enabled
  MasterPassword = 1, // Sets minimum requirements for master password complexity
  PasswordGenerator = 2, // Sets minimum requirements/default type for generated passwords/passphrases
  SingleOrg = 3, // Allows users to only be apart of one organization
  RequireSso = 4, // Requires users to authenticate with SSO
  PersonalOwnership = 5, // Disables personal vault ownership for adding/cloning items
  DisableSend = 6, // Disables the ability to create and edit Bitwarden Sends
  SendOptions = 7, // Sets restrictions or defaults for Bitwarden Sends
  ResetPassword = 8, // Allows orgs to use reset password : also can enable auto-enrollment during invite flow
  MaximumVaultTimeout = 9, // Sets the maximum allowed vault timeout
  DisablePersonalVaultExport = 10, // Disable personal vault export
  ActivateAutofill = 11, // Activates autofill with page load on the browser extension
}

type PolicyDataType = {
  id: string;
  organizationId: string;
  type: PolicyType;
  data: Record<string, string | number | boolean>;
  enabled: boolean;
};

type ExpectedAccountType = {
  data?: {
    policies?: {
      encrypted?: Record<string, PolicyDataType>;
    };
  };
};

const POLICIES_KEY: KeyDefinitionLike = {
  key: "policies",
  stateDefinition: {
    name: "policies",
  },
};

export class PolicyMigrator extends Migrator<29, 30> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();

    async function migrateAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = account?.data?.policies?.encrypted;
      if (value != null) {
        await helper.setToUser(userId, POLICIES_KEY, value);
        delete account.data.policies;
        await helper.set(userId, account);
      }
    }

    await Promise.all(accounts.map(({ userId, account }) => migrateAccount(userId, account)));
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();

    async function rollbackAccount(userId: string, account: ExpectedAccountType): Promise<void> {
      const value = await helper.getFromUser(userId, POLICIES_KEY);
      if (account) {
        account.data = Object.assign(account.data ?? {}, {
          policies: {
            encrypted: value,
          },
        });

        await helper.set(userId, account);
      }
      await helper.setToUser(userId, POLICIES_KEY, null);
    }
    await Promise.all(accounts.map(({ userId, account }) => rollbackAccount(userId, account)));
  }
}
