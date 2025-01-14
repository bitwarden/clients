// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

// FIXME: Remove when updating file. Eslint update
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const UriMatchStrategy = {
  Domain: 0,
  Host: 1,
  StartsWith: 2,
  Exact: 3,
  RegularExpression: 4,
  Never: 5,
} as const;

type UriMatchStrategySetting = (typeof UriMatchStrategy)[keyof typeof UriMatchStrategy];

type ExpectedAccountState = {
  settings?: {
    defaultUriMatch?: UriMatchStrategySetting;
    settings?: {
      equivalentDomains?: string[][];
    };
  };
};

type ExpectedGlobalState = {
  neverDomains?: { [key: string]: null };
};

const defaultUriMatchStrategyDefinition: KeyDefinitionLike = {
  stateDefinition: {
    name: "domainSettings",
  },
  key: "defaultUriMatchStrategy",
};

const equivalentDomainsDefinition: KeyDefinitionLike = {
  stateDefinition: {
    name: "domainSettings",
  },
  key: "equivalentDomains",
};

const neverDomainsDefinition: KeyDefinitionLike = {
  stateDefinition: {
    name: "domainSettings",
  },
  key: "neverDomains",
};

export class DomainSettingsMigrator extends Migrator<33, 34> {
  async migrate(helper: MigrationHelper): Promise<void> {
    let updateAccount = false;

    // global state ("neverDomains")
    const globalState = await helper.get<ExpectedGlobalState>("global");

    if (globalState?.neverDomains != null) {
      await helper.setToGlobal(neverDomainsDefinition, globalState.neverDomains);

      // delete `neverDomains` from state global
      delete globalState.neverDomains;

      await helper.set<ExpectedGlobalState>("global", globalState);
    }

    // account state ("defaultUriMatch" and "settings.equivalentDomains")
    const accounts = await helper.getAccounts<ExpectedAccountState>();

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);

    // migrate account state
    async function migrateAccount(userId: string, account: ExpectedAccountState): Promise<void> {
      const accountSettings = account?.settings;

      if (accountSettings?.defaultUriMatch != undefined) {
        await helper.setToUser(
          userId,
          defaultUriMatchStrategyDefinition,
          accountSettings.defaultUriMatch,
        );
        delete account.settings.defaultUriMatch;

        updateAccount = true;
      }

      if (accountSettings?.settings?.equivalentDomains != undefined) {
        await helper.setToUser(
          userId,
          equivalentDomainsDefinition,
          accountSettings.settings.equivalentDomains,
        );
        delete account.settings.settings.equivalentDomains;
        delete account.settings.settings;

        updateAccount = true;
      }

      if (updateAccount) {
        // update the state account settings with the migrated values deleted
        await helper.set(userId, account);
      }
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    let updateAccount = false;

    // global state ("neverDomains")
    const globalState = (await helper.get<ExpectedGlobalState>("global")) || {};
    const neverDomains: { [key: string]: null } =
      await helper.getFromGlobal(neverDomainsDefinition);

    if (neverDomains != null) {
      await helper.set<ExpectedGlobalState>("global", {
        ...globalState,
        neverDomains: neverDomains,
      });

      // remove the global state provider framework key for `neverDomains`
      await helper.setToGlobal(neverDomainsDefinition, null);
    }

    // account state ("defaultUriMatchStrategy" and "equivalentDomains")
    const accounts = await helper.getAccounts<ExpectedAccountState>();

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);

    // rollback account state
    async function rollbackAccount(userId: string, account: ExpectedAccountState): Promise<void> {
      let settings = account?.settings || {};

      const defaultUriMatchStrategy: UriMatchStrategySetting = await helper.getFromUser(
        userId,
        defaultUriMatchStrategyDefinition,
      );

      const equivalentDomains: string[][] = await helper.getFromUser(
        userId,
        equivalentDomainsDefinition,
      );

      // update new settings and remove the account state provider framework keys for the rolled back values
      if (defaultUriMatchStrategy != null) {
        settings = { ...settings, defaultUriMatch: defaultUriMatchStrategy };

        await helper.setToUser(userId, defaultUriMatchStrategyDefinition, null);

        updateAccount = true;
      }

      if (equivalentDomains != null) {
        settings = { ...settings, settings: { equivalentDomains } };

        await helper.setToUser(userId, equivalentDomainsDefinition, null);

        updateAccount = true;
      }

      // commit updated settings to state
      if (updateAccount) {
        await helper.set(userId, {
          ...account,
          settings,
        });
      }
    }
  }
}
