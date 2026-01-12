import { KeyDefinitionLike, MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { Migrator } from "../migrator";

type EnvironmentUrls = Record<string, string>;

type ExpectedAccountType = {
  settings?: { region?: string; environmentUrls?: EnvironmentUrls };
};

type ExpectedGlobalType = { region?: string; environmentUrls?: EnvironmentUrls };

const ENVIRONMENT_STATE: StateDefinitionLike = { name: "environment" };

const REGION_KEY: KeyDefinitionLike = { key: "region", stateDefinition: ENVIRONMENT_STATE };
const URLS_KEY: KeyDefinitionLike = { key: "urls", stateDefinition: ENVIRONMENT_STATE };

export class MoveEnvironmentStateToProviders extends Migrator<11, 12> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const legacyGlobal = await helper.get<ExpectedGlobalType>("global");

    // Move global data
    if (legacyGlobal?.region != null) {
      await helper.setToGlobal(REGION_KEY, legacyGlobal.region);
    }

    if (legacyGlobal?.environmentUrls != null) {
      await helper.setToGlobal(URLS_KEY, legacyGlobal.environmentUrls);
    }

    const legacyAccounts = await helper.getAccounts<ExpectedAccountType>();

    await Promise.all(
      legacyAccounts.map(async ({ userId, account }) => {
        // Move account data
        if (account?.settings?.region != null) {
          await helper.setToUser(userId, REGION_KEY, account.settings.region);
        }

        if (account?.settings?.environmentUrls != null) {
          await helper.setToUser(userId, URLS_KEY, account.settings.environmentUrls);
        }

        // Delete old account data
        delete account?.settings?.region;
        delete account?.settings?.environmentUrls;
        await helper.set(userId, account);
      }),
    );

    // Delete legacy global data
    delete legacyGlobal?.region;
    delete legacyGlobal?.environmentUrls;
    await helper.set("global", legacyGlobal);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    let legacyGlobal = await helper.get<ExpectedGlobalType>("global");

    let updatedLegacyGlobal = false;

    const globalRegion = await helper.getFromGlobal<string>(REGION_KEY);

    if (globalRegion) {
      if (!legacyGlobal) {
        legacyGlobal = {};
      }

      updatedLegacyGlobal = true;
      legacyGlobal.region = globalRegion;
      await helper.setToGlobal(REGION_KEY, null);
    }

    const globalUrls = await helper.getFromGlobal<EnvironmentUrls>(URLS_KEY);

    if (globalUrls) {
      if (!legacyGlobal) {
        legacyGlobal = {};
      }

      updatedLegacyGlobal = true;
      legacyGlobal.environmentUrls = globalUrls;
      await helper.setToGlobal(URLS_KEY, null);
    }

    if (updatedLegacyGlobal) {
      await helper.set("global", legacyGlobal);
    }

    async function rollbackUser(userId: string, account: ExpectedAccountType) {
      let updatedAccount = false;
      const userRegion = await helper.getFromUser<string>(userId, REGION_KEY);

      if (userRegion) {
        if (!account) {
          account = {};
        }

        if (!account.settings) {
          account.settings = {};
        }

        updatedAccount = true;
        account.settings.region = userRegion;
        await helper.setToUser(userId, REGION_KEY, null);
      }

      const userUrls = await helper.getFromUser<EnvironmentUrls>(userId, URLS_KEY);

      if (userUrls) {
        if (!account) {
          account = {};
        }

        if (!account.settings) {
          account.settings = {};
        }

        updatedAccount = true;
        account.settings.environmentUrls = userUrls;
        await helper.setToUser(userId, URLS_KEY, null);
      }

      if (updatedAccount) {
        await helper.set(userId, account);
      }
    }

    const accounts = await helper.getAccounts<ExpectedAccountType>();

    await Promise.all(accounts.map(({ userId, account }) => rollbackUser(userId, account)));
  }
}
