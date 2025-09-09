import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

export const SHOW_BANNER: KeyDefinitionLike = {
  key: "showBanner",
  stateDefinition: { name: "unassignedItemsBanner" },
};

export class RemoveUnassignedItemsBannerDismissed extends Migrator<66, 67> {
  async migrate(helper: MigrationHelper): Promise<void> {
    await Promise.all(
      (await helper.getAccounts()).map(async ({ userId }) => {
        if (helper.getFromUser(userId, SHOW_BANNER) != null) {
          await helper.removeFromUser(userId, SHOW_BANNER);
        }
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
