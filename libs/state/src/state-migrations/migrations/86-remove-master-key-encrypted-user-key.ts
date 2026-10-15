import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

const MASTER_KEY_ENCRYPTED_USER_KEY: KeyDefinitionLike = {
  key: "masterKeyEncryptedUserKey",
  stateDefinition: { name: "masterPassword" },
};

/**
 * Removes the orphaned master-key-wrapped user key. Unlock reads the wrapped user key from the
 * master-password unlock data instead (backfilled by migration 73), so the persisted value is
 * dropped rather than left on disk.
 */
export class RemoveMasterKeyEncryptedUserKey extends Migrator<85, 86> {
  async migrate(helper: MigrationHelper): Promise<void> {
    await Promise.all(
      (await helper.getAccounts()).map(async ({ userId }) => {
        if ((await helper.getFromUser(userId, MASTER_KEY_ENCRYPTED_USER_KEY)) != null) {
          await helper.removeFromUser(userId, MASTER_KEY_ENCRYPTED_USER_KEY);
        }
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
