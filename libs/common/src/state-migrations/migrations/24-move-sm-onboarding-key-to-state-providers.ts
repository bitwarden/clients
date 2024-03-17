import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountType = {
  settings?: {
    smOnboardingTasks?: Record<string, Record<string, boolean>>;
  };
};

export const SM_ONBOARDING_TASKS: KeyDefinitionLike = {
  key: "tasks",
  stateDefinition: { name: "smOnboarding" },
};

export class SmOnboardingTasksMigrator extends Migrator<23, 24> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const legacyAccounts = await helper.getAccounts<ExpectedAccountType>();

    await Promise.all(
      legacyAccounts.map(async ({ userId, account }) => {
        // Move account data
        if (account?.settings?.smOnboardingTasks != null) {
          await helper.setToUser(userId, SM_ONBOARDING_TASKS, account.settings.smOnboardingTasks);

          // Delete old account data
          delete account.settings.smOnboardingTasks;
          await helper.set(userId, account);
        }
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    async function rollbackUser(userId: string, account: ExpectedAccountType) {
      const smOnboardingTasks = await helper.getFromUser<Record<string, Record<string, boolean>>>(
        userId,
        SM_ONBOARDING_TASKS,
      );
      if (smOnboardingTasks) {
        account ??= {};
        account.settings ??= {};

        account.settings.smOnboardingTasks = smOnboardingTasks;
        await helper.setToUser(userId, SM_ONBOARDING_TASKS, null);
        await helper.set(userId, account);
      }
    }

    const accounts = await helper.getAccounts<ExpectedAccountType>();

    await Promise.all(accounts.map(({ userId, account }) => rollbackUser(userId, account)));
  }
}
