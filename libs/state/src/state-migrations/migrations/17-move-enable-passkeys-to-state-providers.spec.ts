import { MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { EnablePasskeysMigrator } from "./17-move-enable-passkeys-to-state-providers";

function exampleJSON() {
  return {
    global: {
      enablePasskeys: true,
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

function rollbackJSON() {
  return {
    global_vaultSettings_enablePasskeys: true,
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

describe("EnablePasskeysMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: EnablePasskeysMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 16);
      sut = new EnablePasskeysMigrator(16, 17);
    });

    it("should remove enablePasskeys from global", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("global", {
        otherStuff: "otherStuff1",
      });
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 17);
      sut = new EnablePasskeysMigrator(16, 17);
    });

    it("should move enablePasskeys to global", async () => {
      await sut.rollback(helper);
      expect(helper.set).toHaveBeenCalledWith("global", {
        enablePasskeys: true,
        otherStuff: "otherStuff1",
      });
    });
  });
});
