import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import {
  REQUIRE_PASSWORD_ON_START,
  RequirePasswordOnStartMigrator,
} from "./19-migrate-require-password-on-start";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
    "user-1": {
      settings: {
        requirePasswordOnStart: true,
        otherStuff: "overStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      keys: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

function rollbackJSON() {
  return {
    "user_user-1_biometricSettings_requirePasswordOnStart": true,
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
    "user-1": {
      settings: {
        otherStuff: "overStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      keys: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

describe("DesktopBiometricState migrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: RequirePasswordOnStartMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 18);
      sut = new RequirePasswordOnStartMigrator(18, 19);
    });

    it("should remove biometricEncryptionClientKeyHalf from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          otherStuff: "overStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should set biometricEncryptionClientKeyHalf value for account that have it", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user-1", REQUIRE_PASSWORD_ON_START, true);
    });

    it("should not call extra setToUser", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(1);
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 19);
      sut = new RequirePasswordOnStartMigrator(18, 19);
    });

    it("should null out new values", async () => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user-1", REQUIRE_PASSWORD_ON_START, null);
    });

    it("should add explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          requirePasswordOnStart: true,
          otherStuff: "overStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it.each(["user-2", "user-3"])(
      "should not try to restore values to missing accounts",
      async (userId) => {
        await sut.rollback(helper);

        expect(helper.set).not.toHaveBeenCalledWith(userId, any());
      },
    );
  });
});
