// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountState = {
  settings?: {
    disableBadgeCounter?: boolean;
  };
};

const enableBadgeCounterKeyDefinition: KeyDefinitionLike = {
  stateDefinition: {
    name: "badgeSettings",
  },
  key: "enableBadgeCounter",
};

export class BadgeSettingsMigrator extends Migrator<26, 27> {
  async migrate(helper: MigrationHelper): Promise<void> {
    // account state (e.g. account settings -> state provider framework keys)
    const accounts = await helper.getAccounts<ExpectedAccountState>();

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);

    // migrate account state
    async function migrateAccount(userId: string, account: ExpectedAccountState): Promise<void> {
      const accountSettings = account?.settings;

      if (accountSettings?.disableBadgeCounter != undefined) {
        await helper.setToUser(
          userId,
          enableBadgeCounterKeyDefinition,
          !accountSettings.disableBadgeCounter,
        );
        delete account.settings.disableBadgeCounter;

        // update the state account settings with the migrated values deleted
        await helper.set(userId, account);
      }
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    // account state (e.g. state provider framework keys -> account settings)
    const accounts = await helper.getAccounts<ExpectedAccountState>();

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);

    // rollback account state
    async function rollbackAccount(userId: string, account: ExpectedAccountState): Promise<void> {
      let settings = account?.settings || {};

      const enableBadgeCounter: boolean = await helper.getFromUser(
        userId,
        enableBadgeCounterKeyDefinition,
      );

      // update new settings and remove the account state provider framework keys for the rolled back values
      if (enableBadgeCounter != undefined) {
        settings = { ...settings, disableBadgeCounter: !enableBadgeCounter };

        await helper.setToUser(userId, enableBadgeCounterKeyDefinition, null);

        // commit updated settings to state
        await helper.set(userId, {
          ...account,
          settings,
        });
      }
    }
  }
}
