import { any, MockProxy } from "jest-mock-extended";

import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { EnableContextMenuMigrator } from "./31-move-enable-context-menu-to-autofill-settings-state-provider";

function exampleJSON() {
  return {
    global: {
      disableContextMenuItem: true,
      otherStuff: "otherStuff1",
    },
    otherStuff: "otherStuff2",
  };
}

function rollbackJSON() {
  return {
    global_autofillSettings_enableContextMenu: false,
    global: {
      otherStuff: "otherStuff1",
    },
    otherStuff: "otherStuff2",
  };
}

const enableContextMenuKeyDefinition: KeyDefinitionLike = {
  stateDefinition: {
    name: "autofillSettings",
  },
  key: "enableContextMenu",
};

describe("EnableContextMenuMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: EnableContextMenuMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 30);
      sut = new EnableContextMenuMigrator(30, 31);
    });

    it("should remove global disableContextMenuItem setting", async () => {
      await sut.migrate(helper);

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("global", {
        otherStuff: "otherStuff1",
      });
    });

    it("should set enableContextMenu globally", async () => {
      await sut.migrate(helper);

      expect(helper.setToGlobal).toHaveBeenCalledTimes(1);
      expect(helper.setToGlobal).toHaveBeenCalledWith(enableContextMenuKeyDefinition, false);
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 31);
      sut = new EnableContextMenuMigrator(30, 31);
    });

    it("should null out new enableContextMenu global value", async () => {
      await sut.rollback(helper);

      expect(helper.setToGlobal).toHaveBeenCalledTimes(1);
      expect(helper.setToGlobal).toHaveBeenCalledWith(enableContextMenuKeyDefinition, null);
    });

    it("should add disableContextMenuItem global value back", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("global", {
        disableContextMenuItem: true,
        otherStuff: "otherStuff1",
      });
    });

    it("should not try to restore values to missing accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).not.toHaveBeenCalledWith("user-3", any());
    });
  });
});
