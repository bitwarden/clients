import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

export const SHOW_BANNER_KEY: KeyDefinitionLike = {
  key: "showAccountDeprovisioningBanner",
  stateDefinition: { name: "accountDeprovisioningBanner" },
};

export class RemoveAccountDeprovisioningBannerDismissed extends Migrator<71, 72> {
  async migrate(helper: MigrationHelper): Promise<void> {
    await Promise.all(
      (await helper.getAccounts()).map(async ({ userId }) => {
        if (helper.getFromUser(userId, SHOW_BANNER_KEY) != null) {
          await helper.removeFromUser(userId, SHOW_BANNER_KEY);
        }
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
