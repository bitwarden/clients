import { KeyDefinitionLike, MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { Migrator } from "../migrator";

const ENVIRONMENT_STATE: StateDefinitionLike = { name: "environment" };

const ENVIRONMENT_REGION: KeyDefinitionLike = {
  key: "region",
  stateDefinition: ENVIRONMENT_STATE,
};

const ENVIRONMENT_URLS: KeyDefinitionLike = {
  key: "urls",
  stateDefinition: ENVIRONMENT_STATE,
};

const ENVIRONMENT_ENVIRONMENT: KeyDefinitionLike = {
  key: "environment",
  stateDefinition: ENVIRONMENT_STATE,
};

export class MergeEnvironmentState extends Migrator<44, 45> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<unknown>();

    async function migrateAccount(userId: string, account: unknown): Promise<void> {
      const region = await helper.getFromUser(userId, ENVIRONMENT_REGION);
      const urls = await helper.getFromUser(userId, ENVIRONMENT_URLS);

      if (region == null && urls == null) {
        return;
      }

      await helper.setToUser(userId, ENVIRONMENT_ENVIRONMENT, {
        region,
        urls,
      });
      await helper.removeFromUser(userId, ENVIRONMENT_REGION);
      await helper.removeFromUser(userId, ENVIRONMENT_URLS);
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);

    const region = await helper.getFromGlobal(ENVIRONMENT_REGION);
    const urls = await helper.getFromGlobal(ENVIRONMENT_URLS);

    if (region == null && urls == null) {
      return;
    }

    await helper.setToGlobal(ENVIRONMENT_ENVIRONMENT, {
      region,
      urls,
    });
    await helper.removeFromGlobal(ENVIRONMENT_REGION);
    await helper.removeFromGlobal(ENVIRONMENT_URLS);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<unknown>();

    async function rollbackAccount(userId: string, account: unknown): Promise<void> {
      const state = (await helper.getFromUser(userId, ENVIRONMENT_ENVIRONMENT)) as {
        region: string;
        urls: string;
      } | null;

      await helper.setToUser(userId, ENVIRONMENT_REGION, state?.region);
      await helper.setToUser(userId, ENVIRONMENT_URLS, state?.urls);
      await helper.removeFromUser(userId, ENVIRONMENT_ENVIRONMENT);
    }

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);

    const state = (await helper.getFromGlobal(ENVIRONMENT_ENVIRONMENT)) as {
      region: string;
      urls: string;
    } | null;

    await helper.setToGlobal(ENVIRONMENT_REGION, state?.region);
    await helper.setToGlobal(ENVIRONMENT_URLS, state?.urls);
    await helper.removeFromGlobal(ENVIRONMENT_ENVIRONMENT);
  }
}
