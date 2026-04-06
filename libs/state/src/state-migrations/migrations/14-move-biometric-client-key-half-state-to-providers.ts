import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountType = {
  settings?: {
    disableAutoBiometricsPrompt?: boolean;
    biometricUnlock?: boolean;
    dismissedBiometricRequirePasswordOnStartCallout?: boolean;
  };
  keys?: { biometricEncryptionClientKeyHalf?: string };
};

// Biometric text, no auto prompt text, fingerprint validated, and prompt cancelled are refreshed on every app start, so we don't need to migrate them
export const CLIENT_KEY_HALF: KeyDefinitionLike = {
  key: "clientKeyHalf",
  stateDefinition: { name: "biometricSettings" },
};

export class MoveBiometricClientKeyHalfToStateProviders extends Migrator<13, 14> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const legacyAccounts = await helper.getAccounts<ExpectedAccountType>();

    await Promise.all(
      legacyAccounts.map(async ({ userId, account }) => {
        // Move account data
        if (account?.keys?.biometricEncryptionClientKeyHalf != null) {
          await helper.setToUser(
            userId,
            CLIENT_KEY_HALF,
            account.keys.biometricEncryptionClientKeyHalf,
          );

          // Delete old account data
          delete account?.keys?.biometricEncryptionClientKeyHalf;
          await helper.set(userId, account);
        }
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    async function rollbackUser(userId: string, account: ExpectedAccountType) {
      let updatedAccount = false;

      const userKeyHalf = await helper.getFromUser<string>(userId, CLIENT_KEY_HALF);

      if (userKeyHalf) {
        account ??= {};
        account.keys ??= {};

        updatedAccount = true;
        account.keys.biometricEncryptionClientKeyHalf = userKeyHalf;
        await helper.setToUser(userId, CLIENT_KEY_HALF, null);
      }

      if (updatedAccount) {
        await helper.set(userId, account);
      }
    }

    const accounts = await helper.getAccounts<ExpectedAccountType>();

    await Promise.all(accounts.map(({ userId, account }) => rollbackUser(userId, account)));
  }
}
