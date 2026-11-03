import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

const POLICIES: KeyDefinitionLike = {
  key: "policies",
  stateDefinition: { name: "policies" },
};

const POLICIES_NEW: KeyDefinitionLike = {
  key: "policiesNew",
  stateDefinition: { name: "policies" },
};

/**
 * Copies the accepted and confirmed policy data from `policiesNew` into `policies`, overwriting the
 * confirmed-only data, so that `policies` becomes the single source of policy state.
 * `policiesNew` is left in place and will be removed by a later migration (PM-45288).
 */
export class MigratePoliciesNewToPolicies extends Migrator<86, 87> {
  async migrate(helper: MigrationHelper): Promise<void> {
    await Promise.all(
      (await helper.getAccounts()).map(async ({ userId }) => {
        const policiesNew = await helper.getFromUser(userId, POLICIES_NEW);
        if (policiesNew != null) {
          await helper.setToUser(userId, POLICIES, policiesNew);
        }
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
