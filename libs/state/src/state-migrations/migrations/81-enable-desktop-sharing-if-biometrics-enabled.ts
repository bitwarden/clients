import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

const BIOMETRIC_UNLOCK_ENABLED: KeyDefinitionLike = {
  key: "biometricUnlockEnabled",
  stateDefinition: { name: "biometricSettings" },
};

const ALLOW_SHARING_UNLOCK_STATE_WITH_DESKTOP: KeyDefinitionLike = {
  key: "allowSharingUnlockStateWithDesktop",
  stateDefinition: { name: "sharedUnlockSettings" },
};

/**
 * For each user that already has biometric unlock enabled, enables sharing unlock state
 * with the desktop app. Previously this setting defaulted to off even when biometrics were
 * configured, so existing users had to manually enable it.
 */
export class EnableDesktopSharingIfBiometricsEnabled extends Migrator<80, 81> {
  async migrate(helper: MigrationHelper): Promise<void> {
    async function migrateUser(userId: string) {
      const biometricUnlock = await helper.getFromUser<boolean>(userId, BIOMETRIC_UNLOCK_ENABLED);

      if (
        biometricUnlock === true &&
        (await helper.getFromUser(userId, ALLOW_SHARING_UNLOCK_STATE_WITH_DESKTOP)) == null
      ) {
        await helper.setToUser(userId, ALLOW_SHARING_UNLOCK_STATE_WITH_DESKTOP, true);
      }
    }

    const accounts = await helper.getAccounts();
    await Promise.all(accounts.map(({ userId }) => migrateUser(userId)));
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    async function rollbackUser(userId: string) {
      const biometricUnlock = await helper.getFromUser<boolean>(userId, BIOMETRIC_UNLOCK_ENABLED);

      if (biometricUnlock === true) {
        await helper.removeFromUser(userId, ALLOW_SHARING_UNLOCK_STATE_WITH_DESKTOP);
      }
    }

    const accounts = await helper.getAccounts();
    await Promise.all(accounts.map(({ userId }) => rollbackUser(userId)));
  }
}
