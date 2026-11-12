import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

export const KDF_CONFIG: KeyDefinitionLike = {
  key: "kdfConfig",
  stateDefinition: { name: "kdfConfig" },
};

/**
 * Removes the orphaned KDF config. The KDF is read from the master-password unlock data instead
 * (backfilled by migration 73), so the persisted value is dropped rather than left on disk.
 */
export class RemoveKdfConfig extends Migrator<87, 88> {
  async migrate(helper: MigrationHelper): Promise<void> {
    await Promise.all(
      (await helper.getAccounts()).map(async ({ userId }) => {
        if ((await helper.getFromUser(userId, KDF_CONFIG)) != null) {
          await helper.removeFromUser(userId, KDF_CONFIG);
        }
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
