import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

export const SHOW_BANNER_KEY: KeyDefinitionLike = {
  key: "acBannersDismissed",
  stateDefinition: { name: "showProviderClientVaultPrivacyBanner" },
};

export class RemoveAcBannersDismissed extends Migrator<69, 70> {
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
