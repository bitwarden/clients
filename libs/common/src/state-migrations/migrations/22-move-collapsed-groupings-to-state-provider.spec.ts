import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { CollapsedGroupingsMigrator } from "./22-move-collapsed-groupings-to-state-provider";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
    "user-1": {
      settings: {
        collapsedGroupings: ["grouping-1", "grouping-2"],
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      settings: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

function rollbackJSON() {
  return {
    "user_user-1_vaultFilter_collapsedGroupings": ["grouping-1", "grouping-2"],
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      settings: {
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      settings: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

describe("CollapsedGroupingsMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: CollapsedGroupingsMigrator;
  const keyDefinitionLike = {
    key: "collapsedGroupings",
    stateDefinition: {
      name: "vaultFilter",
    },
  };

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 21);
      sut = new CollapsedGroupingsMigrator(21, 22);
    });

    it("should remove collapsedGroupings from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should set collapsedGroupings values for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user-1", keyDefinitionLike, [
        "grouping-1",
        "grouping-2",
      ]);
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 22);
      sut = new CollapsedGroupingsMigrator(21, 22);
    });

    it.each(["user-1", "user-2"])("should null out new values", async (userId) => {
      await sut.rollback(helper);
      expect(helper.setToUser).toHaveBeenCalledWith(userId, keyDefinitionLike, null);
    });

    it("should add explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(2);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          collapsedGroupings: ["grouping-1", "grouping-2"],
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should not try to restore values to missing accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).not.toHaveBeenCalledWith("user-3", any());
    });
  });
});
