import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedAccountType = {
  settings?: {
    biometricUnlock?: boolean;
  };
};

export const BIOMETRIC_UNLOCK_ENABLED: KeyDefinitionLike = {
  key: "biometricUnlockEnabled",
  stateDefinition: { name: "biometricSettings" },
};

export class MoveBiometricUnlockToStateProviders extends Migrator<27, 28> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const legacyAccounts = await helper.getAccounts<ExpectedAccountType>();

    await Promise.all(
      legacyAccounts.map(async ({ userId, account }) => {
        if (account == null) {
          return;
        }
        // Move account data
        if (account?.settings?.biometricUnlock != null) {
          await helper.setToUser(
            userId,
            BIOMETRIC_UNLOCK_ENABLED,
            account.settings.biometricUnlock,
          );
        }

        // Delete old account data
        delete account?.settings?.biometricUnlock;
        await helper.set(userId, account);
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    async function rollbackUser(userId: string, account: ExpectedAccountType) {
      const biometricUnlock = await helper.getFromUser<boolean>(userId, BIOMETRIC_UNLOCK_ENABLED);

      if (biometricUnlock != null) {
        account ??= {};
        account.settings ??= {};

        account.settings.biometricUnlock = biometricUnlock;
        await helper.setToUser(userId, BIOMETRIC_UNLOCK_ENABLED, null);
        await helper.set(userId, account);
      }
    }

    const accounts = await helper.getAccounts<ExpectedAccountType>();

    await Promise.all(accounts.map(({ userId, account }) => rollbackUser(userId, account)));
  }
}
