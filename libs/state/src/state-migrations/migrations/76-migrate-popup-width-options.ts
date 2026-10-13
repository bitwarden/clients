import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

/** Maps old popup width option keys to their new equivalents. */
const OLD_TO_NEW_WIDTH_MAP: Record<string, string> = {
  wide: "default",
  "extra-wide": "wide",
};

export const POPUP_WIDTH_KEY: KeyDefinitionLike = {
  key: "popup-width",
  stateDefinition: { name: "popupStyle" },
};

export class MigratePopupWidthOptions extends Migrator<75, 76> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const currentWidth = await helper.getFromGlobal<string>(POPUP_WIDTH_KEY);

    if (currentWidth != null && currentWidth in OLD_TO_NEW_WIDTH_MAP) {
      await helper.setToGlobal(POPUP_WIDTH_KEY, OLD_TO_NEW_WIDTH_MAP[currentWidth]);
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
