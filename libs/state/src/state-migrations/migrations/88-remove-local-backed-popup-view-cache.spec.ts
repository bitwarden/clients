import { ClientType } from "@bitwarden/client-type";

import { mockMigrationHelper } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import {
  ORPHANED_POPUP_VIEW_CACHE_KEYS,
  RemoveLocalBackedPopupViewCache,
} from "./88-remove-local-backed-popup-view-cache";

describe("RemoveLocalBackedPopupViewCache", () => {
  const sut = new RemoveLocalBackedPopupViewCache(87, 88);

  const [viewCacheKey, routeHistoryKey] = ORPHANED_POPUP_VIEW_CACHE_KEYS;

  function storageWithOrphans() {
    return {
      [viewCacheKey]: "2.encrypted-view-cache",
      [routeHistoryKey]: "2.encrypted-route-history",
      session_global_decryptedFolders_folders: "2.encrypted-folders",
      global_popupView_unrelated: "kept",
    };
  }

  describe("migrate", () => {
    it("removes the orphaned view cache keys from browser local storage", async () => {
      const storage = storageWithOrphans();
      const helper = mockMigrationHelper(storage, 87, "general", ClientType.Browser);

      await sut.migrate(helper);

      expect(await helper.get(viewCacheKey)).toBeUndefined();
      expect(await helper.get(routeHistoryKey)).toBeUndefined();
    });

    it("leaves other session and popupView keys alone", async () => {
      const storage = storageWithOrphans();
      const helper = mockMigrationHelper(storage, 87, "general", ClientType.Browser);

      await sut.migrate(helper);

      expect(await helper.get("session_global_decryptedFolders_folders")).toBe(
        "2.encrypted-folders",
      );
      expect(await helper.get("global_popupView_unrelated")).toBe("kept");
    });

    it("does nothing when the keys are absent", async () => {
      const helper = mockMigrationHelper({}, 87, "general", ClientType.Browser);

      await sut.migrate(helper);

      expect(helper.remove).not.toHaveBeenCalled();
    });

    it.each([ClientType.Web, ClientType.Desktop, ClientType.Cli])(
      "does nothing on %s",
      async (clientType) => {
        const storage = storageWithOrphans();
        const helper = mockMigrationHelper(storage, 87, "general", clientType);

        await sut.migrate(helper);

        expect(helper.remove).not.toHaveBeenCalled();
        expect(await helper.get(viewCacheKey)).toBe("2.encrypted-view-cache");
      },
    );
  });

  describe("rollback", () => {
    it("is irreversible", async () => {
      const helper = mockMigrationHelper({}, 88, "general", ClientType.Browser);

      await expect(sut.rollback(helper)).rejects.toThrow(IRREVERSIBLE);
    });
  });
});
