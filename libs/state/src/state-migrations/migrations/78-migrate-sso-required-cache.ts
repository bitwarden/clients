import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

export const SSO_REQUIRED_CACHE_KEY: KeyDefinitionLike = {
  key: "ssoRequiredCache",
  stateDefinition: { name: "ssoLoginLocal" },
};

/**
 * Migrates the `ssoRequiredCache` from the old `string[]` format (email-only) to `null`,
 * clearing stale entries that cannot be migrated since the environment (webVaultUrl) cannot
 * be inferred from an email alone. The cache will be repopulated with the new SsoRequiredCacheEntry[]
 * format on the user's next SSO login.
 */
export class MigrateSsoRequiredCache extends Migrator<77, 78> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const cache = await helper.getFromGlobal<unknown[]>(SSO_REQUIRED_CACHE_KEY);

    if (cache == null || cache.length === 0) {
      return;
    }

    if (typeof cache[0] === "string") {
      await helper.setToGlobal(SSO_REQUIRED_CACHE_KEY, null);
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
