import { KeyDefinitionLike, MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

const BIOMETRIC_SETTINGS_STATE: StateDefinitionLike = { name: "biometricSettings" };

const CLIENT_KEY_HALF_KEY: KeyDefinitionLike = {
  key: "clientKeyHalf",
  stateDefinition: BIOMETRIC_SETTINGS_STATE,
};

const FINGERPRINT_VALIDATED_KEY: KeyDefinitionLike = {
  key: "fingerprintValidated",
  stateDefinition: BIOMETRIC_SETTINGS_STATE,
};

/**
 * Removes the orphaned encrypted client key half and the IPC fingerprint validation flag. Neither
 * is read by any unlock path anymore, so the persisted values are dropped.
 */
export class RemoveBiometricClientKeyHalf extends Migrator<84, 85> {
  async migrate(helper: MigrationHelper): Promise<void> {
    await Promise.all(
      (await helper.getAccounts()).map(async ({ userId }) => {
        if ((await helper.getFromUser(userId, CLIENT_KEY_HALF_KEY)) != null) {
          await helper.removeFromUser(userId, CLIENT_KEY_HALF_KEY);
        }
      }),
    );

    if ((await helper.getFromGlobal<boolean>(FINGERPRINT_VALIDATED_KEY)) != null) {
      await helper.removeFromGlobal(FINGERPRINT_VALIDATED_KEY);
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
