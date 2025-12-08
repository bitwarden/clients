import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountType = {
  settings?: {
    disableAutoBiometricsPrompt?: boolean;
    dismissedBiometricRequirePasswordOnStartCallout?: boolean;
  };
};

// prompt cancelled is refreshed on every app start/quit/unlock, so we don't need to migrate it

export const DISMISSED_BIOMETRIC_REQUIRE_PASSWORD_ON_START_CALLOUT: KeyDefinitionLike = {
  key: "dismissedBiometricRequirePasswordOnStartCallout",
  stateDefinition: { name: "biometricSettings" },
};

export const PROMPT_AUTOMATICALLY: KeyDefinitionLike = {
  key: "promptAutomatically",
  stateDefinition: { name: "biometricSettings" },
};

export class MoveBiometricPromptsToStateProviders extends Migrator<22, 23> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const legacyAccounts = await helper.getAccounts<ExpectedAccountType>();

    await Promise.all(
      legacyAccounts.map(async ({ userId, account }) => {
        if (account == null) {
          return;
        }
        // Move account data

        if (account?.settings?.dismissedBiometricRequirePasswordOnStartCallout != null) {
          await helper.setToUser(
            userId,
            DISMISSED_BIOMETRIC_REQUIRE_PASSWORD_ON_START_CALLOUT,
            account.settings.dismissedBiometricRequirePasswordOnStartCallout,
          );
        }

        if (account?.settings?.disableAutoBiometricsPrompt != null) {
          await helper.setToUser(
            userId,
            PROMPT_AUTOMATICALLY,
            !account.settings.disableAutoBiometricsPrompt,
          );
        }

        // Delete old account data
        delete account?.settings?.dismissedBiometricRequirePasswordOnStartCallout;
        delete account?.settings?.disableAutoBiometricsPrompt;
        await helper.set(userId, account);
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    async function rollbackUser(userId: string, account: ExpectedAccountType) {
      let updatedAccount = false;

      const userDismissed = await helper.getFromUser<boolean>(
        userId,
        DISMISSED_BIOMETRIC_REQUIRE_PASSWORD_ON_START_CALLOUT,
      );

      if (userDismissed) {
        account ??= {};
        account.settings ??= {};

        updatedAccount = true;
        account.settings.dismissedBiometricRequirePasswordOnStartCallout = userDismissed;
        await helper.setToUser(userId, DISMISSED_BIOMETRIC_REQUIRE_PASSWORD_ON_START_CALLOUT, null);
      }

      const userPromptAutomatically = await helper.getFromUser<boolean>(
        userId,
        PROMPT_AUTOMATICALLY,
      );

      if (userPromptAutomatically != null) {
        account ??= {};
        account.settings ??= {};

        updatedAccount = true;
        account.settings.disableAutoBiometricsPrompt = !userPromptAutomatically;
        await helper.setToUser(userId, PROMPT_AUTOMATICALLY, null);
      }

      if (updatedAccount) {
        await helper.set(userId, account);
      }
    }

    const accounts = await helper.getAccounts<ExpectedAccountType>();

    await Promise.all(accounts.map(({ userId, account }) => rollbackUser(userId, account)));
  }
}
