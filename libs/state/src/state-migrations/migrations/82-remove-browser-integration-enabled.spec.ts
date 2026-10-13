import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { RemoveBrowserIntegrationEnabled } from "./82-remove-browser-integration-enabled";

describe("RemoveBrowserIntegrationEnabled", () => {
  const sut = new RemoveBrowserIntegrationEnabled(81, 82);

  describe("migrate", () => {
    it("removes the browserIntegrationEnabled key when present and enabled", async () => {
      const output = await runMigrator(sut, {
        global_desktopSettings_browserIntegrationEnabled: true,
      });

      expect(output).toEqual({});
    });

    it("removes the browserIntegrationEnabled key when present and disabled", async () => {
      const output = await runMigrator(sut, {
        global_desktopSettings_browserIntegrationEnabled: false,
      });

      expect(output).toEqual({});
    });

    it("does nothing when the key is not present", async () => {
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
