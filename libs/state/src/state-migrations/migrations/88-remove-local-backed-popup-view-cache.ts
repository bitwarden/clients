import { ClientType } from "@bitwarden/client-type";

import { MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

/**
 * Local storage keys that large-object memory storage used for the browser popup view cache.
 * The cache now lives in session storage, so these encrypted copies are unreadable leftovers.
 */
export const ORPHANED_POPUP_VIEW_CACHE_KEYS = [
  "session_global_popupView_popup-view-cache",
  "session_global_popupView_popup-route-history-details",
];

export class RemoveLocalBackedPopupViewCache extends Migrator<87, 88> {
  async migrate(helper: MigrationHelper): Promise<void> {
    if (helper.clientType !== ClientType.Browser) {
      return;
    }

    await Promise.all(
      ORPHANED_POPUP_VIEW_CACHE_KEYS.map(async (key) => {
        if ((await helper.get(key)) != null) {
          await helper.remove(key);
        }
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
