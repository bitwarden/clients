import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountType = {
  settings?: {
    requirePasswordOnStart?: boolean;
  };
};

// Biometric text, no auto prompt text, fingerprint validated, and prompt cancelled are refreshed on every app start, so we don't need to migrate them
export const REQUIRE_PASSWORD_ON_START: KeyDefinitionLike = {
  key: "requirePasswordOnStart",
  stateDefinition: { name: "biometricSettings" },
};

export class RequirePasswordOnStartMigrator extends Migrator<18, 19> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const legacyAccounts = await helper.getAccounts<ExpectedAccountType>();

    await Promise.all(
      legacyAccounts.map(async ({ userId, account }) => {
        // Move account data
        if (account?.settings?.requirePasswordOnStart != null) {
          await helper.setToUser(
            userId,
            REQUIRE_PASSWORD_ON_START,
            account.settings.requirePasswordOnStart,
          );

          // Delete old account data
          delete account.settings.requirePasswordOnStart;
          await helper.set(userId, account);
        }
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    async function rollbackUser(userId: string, account: ExpectedAccountType) {
      const requirePassword = await helper.getFromUser<boolean>(userId, REQUIRE_PASSWORD_ON_START);

      if (requirePassword) {
        account ??= {};
        account.settings ??= {};

        account.settings.requirePasswordOnStart = requirePassword;
        await helper.setToUser(userId, REQUIRE_PASSWORD_ON_START, null);
        await helper.set(userId, account);
      }
    }

    const accounts = await helper.getAccounts<ExpectedAccountType>();

    await Promise.all(accounts.map(({ userId, account }) => rollbackUser(userId, account)));
  }
}
