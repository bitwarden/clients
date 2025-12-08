import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

export const SHOW_CALLOUT_KEY: KeyDefinitionLike = {
  key: "newCustomizationOptionsCalloutDismissed",
  stateDefinition: { name: "bannersDismissed" },
};

export class RemoveNewCustomizationOptionsCalloutDismissed extends Migrator<70, 71> {
  async migrate(helper: MigrationHelper): Promise<void> {
    await Promise.all(
      (await helper.getAccounts()).map(async ({ userId }) => {
        if (helper.getFromUser(userId, SHOW_CALLOUT_KEY) != null) {
          await helper.removeFromUser(userId, SHOW_CALLOUT_KEY);
        }
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
