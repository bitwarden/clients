import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

export const FEATURE_FLAG_OVERRIDES_KEY: KeyDefinitionLike = {
  key: "featureFlagOverrides",
  stateDefinition: { name: "config" },
};

/**
 * Initializes the global feature flag overrides state to an empty object when it has never
 * been set. The overrides are a record of flag name -> override value; an empty object means
 * "no overrides". Existing override maps are left unchanged.
 */
export class InitializeFeatureFlagOverridesMigrator extends Migrator<78, 79> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const overrides = await helper.getFromGlobal<object>(FEATURE_FLAG_OVERRIDES_KEY);
    if (overrides == null || Object.keys(overrides).length === 0) {
      await helper.setToGlobal(FEATURE_FLAG_OVERRIDES_KEY, {});
    }
  }

  async rollback(): Promise<void> {
    // No-op: an empty overrides object and an unset value are equivalent to every reader
    // (resolveFlag treats both as "no overrides"), and we cannot distinguish an override map
    // we initialized from one a user populated. Leaving the value as-is is safe.
  }
}
