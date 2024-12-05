// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountState = {
  settings?: {
    dontShowCardsCurrentTab?: boolean;
    dontShowIdentitiesCurrentTab?: boolean;
  };
};

const vaultSettingsStateDefinition: {
  stateDefinition: StateDefinitionLike;
} = {
  stateDefinition: {
    name: "vaultSettings",
  },
};

export class VaultSettingsKeyMigrator extends Migrator<35, 36> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountState>();

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);

    async function migrateAccount(userId: string, account: ExpectedAccountState): Promise<void> {
      let updateAccount = false;
      const accountSettings = account?.settings;

      if (accountSettings?.dontShowCardsCurrentTab != null) {
        await helper.setToUser(
          userId,
          { ...vaultSettingsStateDefinition, key: "showCardsCurrentTab" },
          !accountSettings.dontShowCardsCurrentTab,
        );
        delete account.settings.dontShowCardsCurrentTab;
        updateAccount = true;
      }

      if (accountSettings?.dontShowIdentitiesCurrentTab != null) {
        await helper.setToUser(
          userId,
          { ...vaultSettingsStateDefinition, key: "showIdentitiesCurrentTab" },
          !accountSettings.dontShowIdentitiesCurrentTab,
        );
        delete account.settings.dontShowIdentitiesCurrentTab;
        updateAccount = true;
      }

      if (updateAccount) {
        await helper.set(userId, account);
      }
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountState>();

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);

    async function rollbackAccount(userId: string, account: ExpectedAccountState): Promise<void> {
      let updateAccount = false;
      let settings = account?.settings ?? {};

      const showCardsCurrentTab = await helper.getFromUser<boolean>(userId, {
        ...vaultSettingsStateDefinition,
        key: "showCardsCurrentTab",
      });

      const showIdentitiesCurrentTab = await helper.getFromUser<boolean>(userId, {
        ...vaultSettingsStateDefinition,
        key: "showIdentitiesCurrentTab",
      });

      if (showCardsCurrentTab != null) {
        // invert the value to match the new naming convention
        settings = { ...settings, dontShowCardsCurrentTab: !showCardsCurrentTab };

        await helper.setToUser(
          userId,
          { ...vaultSettingsStateDefinition, key: "showCardsCurrentTab" },
          null,
        );

        updateAccount = true;
      }

      if (showIdentitiesCurrentTab != null) {
        // invert the value to match the new naming convention
        settings = { ...settings, dontShowIdentitiesCurrentTab: !showIdentitiesCurrentTab };

        await helper.setToUser(
          userId,
          { ...vaultSettingsStateDefinition, key: "showIdentitiesCurrentTab" },
          null,
        );

        updateAccount = true;
      }

      if (updateAccount) {
        await helper.set(userId, { ...account, settings });
      }
    }
  }
}
