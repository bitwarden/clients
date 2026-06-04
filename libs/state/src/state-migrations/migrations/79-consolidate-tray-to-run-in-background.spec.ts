import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { ConsolidateTrayToRunInBackground } from "./79-consolidate-tray-to-run-in-background";

describe("ConsolidateTrayToRunInBackground", () => {
  const sut = new ConsolidateTrayToRunInBackground(78, 79);

  describe("migrate", () => {
    it("keeps run in background enabled when closeToTray was enabled", async () => {
      const output = await runMigrator(sut, {
        global_desktopSettings_closeToTray: true,
        global_desktopSettings_trayEnabled: false,
      });

      expect(output).toEqual({
        global_desktopSettings_closeToTray: true,
      });
    });

    it("enables run in background when only trayEnabled was set", async () => {
      const output = await runMigrator(sut, {
        global_desktopSettings_closeToTray: false,
        global_desktopSettings_trayEnabled: true,
      });

      expect(output).toEqual({
        global_desktopSettings_closeToTray: true,
      });
    });

    it("disables run in background when both legacy settings were disabled", async () => {
      const output = await runMigrator(sut, {
        global_desktopSettings_closeToTray: false,
        global_desktopSettings_trayEnabled: false,
      });

      expect(output).toEqual({
        global_desktopSettings_closeToTray: false,
      });
    });

    it("removes the orphaned minimizeToTray and alwaysShowDock keys", async () => {
      const output = await runMigrator(sut, {
        global_desktopSettings_closeToTray: true,
        global_desktopSettings_trayEnabled: true,
        global_desktopSettings_minimizeToTray: true,
        global_desktopSettings_alwaysShowDock: true,
      });

      expect(output).toEqual({
        global_desktopSettings_closeToTray: true,
      });
    });

    it("does not write closeToTray when neither legacy setting was present", async () => {
      const output = await runMigrator(sut, {
        global_desktopSettings_minimizeToTray: true,
      });

      expect(output).toEqual({});
    });

    it("does nothing when no desktop settings are present", async () => {
      const output = await runMigrator(sut, {});

      expect(output).toEqual({});
    });
  });

  describe("rollback", () => {
    it("is irreversible", async () => {
      await expect(runMigrator(sut, {}, "rollback")).rejects.toThrow(IRREVERSIBLE);
    });
  });
});
