import { KeyDefinitionLike, MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

const ORGANIZATION_INVITE_DISK: StateDefinitionLike = { name: "organizationInvite" };

const OLD_KEY: KeyDefinitionLike = {
  key: "organizationInvite",
  stateDefinition: ORGANIZATION_INVITE_DISK,
};
const NEW_KEY: KeyDefinitionLike = {
  key: "directOrganizationInvite",
  stateDefinition: ORGANIZATION_INVITE_DISK,
};

/**
 * Renames the stashed direct-invite key from `organizationInvite` to
 * `directOrganizationInvite` to align with the discriminated-union model
 * (`DirectOrganizationInvite` / `OpenOrganizationInvite`). Value shape is unchanged.
 * Global state.
 */
export class RenameOrganizationInviteToDirect extends Migrator<80, 81> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const existing = await helper.getFromGlobal(OLD_KEY);
    if (existing != null) {
      await helper.setToGlobal(NEW_KEY, existing);
      await helper.removeFromGlobal(OLD_KEY);
    }
  }

  rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
