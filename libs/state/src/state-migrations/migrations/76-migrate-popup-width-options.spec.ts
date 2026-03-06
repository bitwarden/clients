import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { MigratePopupWidthOptions } from "./76-migrate-popup-width-options";

describe("MigratePopupWidthOptions", () => {
  const sut = new MigratePopupWidthOptions(75, 76);

  describe("migrate", () => {
    it("migrates 'wide' to 'default'", async () => {
      const output = await runMigrator(sut, {
        "global_popupStyle_popup-width": "wide",
      });

      expect(output).toEqual({
        "global_popupStyle_popup-width": "default",
      });
    });

    it("migrates 'extra-wide' to 'wide'", async () => {
      const output = await runMigrator(sut, {
        "global_popupStyle_popup-width": "extra-wide",
      });

      expect(output).toEqual({
        "global_popupStyle_popup-width": "wide",
      });
    });

    it("does not modify 'default'", async () => {
      const output = await runMigrator(sut, {
        "global_popupStyle_popup-width": "default",
      });

      expect(output).toEqual({
        "global_popupStyle_popup-width": "default",
      });
    });

    it("does not modify 'narrow'", async () => {
      const output = await runMigrator(sut, {
        "global_popupStyle_popup-width": "narrow",
      });

      expect(output).toEqual({
        "global_popupStyle_popup-width": "narrow",
      });
    });

    it("does nothing when no width is set", async () => {
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
