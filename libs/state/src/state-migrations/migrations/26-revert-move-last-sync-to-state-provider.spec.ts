import { any, MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { RevertLastSyncMigrator } from "./26-revert-move-last-sync-to-state-provider";

function rollbackJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      profile: {
        lastSync: "2024-01-24T00:00:00.000Z",
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

function exampleJSON() {
  return {
    "user_user-1_sync_lastSync": "2024-01-24T00:00:00.000Z",
    "user_user-2_sync_lastSync": null as any,
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      profile: {
        lastSync: "2024-01-24T00:00:00.000Z",
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

describe("LastSyncMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: RevertLastSyncMigrator;

  const keyDefinitionLike = {
    key: "lastSync",
    stateDefinition: {
      name: "sync",
    },
  };

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 26);
      sut = new RevertLastSyncMigrator(25, 26);
    });

    it("should remove lastSync from all accounts", async () => {
      await sut.rollback(helper);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        profile: {
          otherStuff: "otherStuff4",
        },
        otherStuff: "otherStuff5",
      });
    });

    it("should set lastSync provider value for each account", async () => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        keyDefinitionLike,
        "2024-01-24T00:00:00.000Z",
      );

      expect(helper.setToUser).toHaveBeenCalledWith("user-2", keyDefinitionLike, null);
    });
  });

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 25);
      sut = new RevertLastSyncMigrator(25, 26);
    });

    it.each(["user-1", "user-2"])("should null out new values", async (userId) => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(userId, keyDefinitionLike, null);
    });

    it("should add lastSync back to accounts", async () => {
      await sut.migrate(helper);

      expect(helper.set).toHaveBeenCalledWith("user-1", {
        profile: {
          lastSync: "2024-01-24T00:00:00.000Z",
          otherStuff: "otherStuff4",
        },
        otherStuff: "otherStuff5",
      });
    });

    it("should not try to restore values to missing accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).not.toHaveBeenCalledWith("user-2", any());
    });
  });
});
