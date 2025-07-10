import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { EverHadUserKeyMigrator } from "./10-move-ever-had-user-key-to-state-providers";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: [
      "c493ed01-4e08-4e88-abc7-332f380ca760",
      "23e61a5f-2ece-4f5e-b499-f0bc489482a9",
      "fd005ea6-a16a-45ef-ba4a-a194269bfd73",
    ],
    "c493ed01-4e08-4e88-abc7-332f380ca760": {
      profile: {
        everHadUserKey: false,
        otherStuff: "overStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "23e61a5f-2ece-4f5e-b499-f0bc489482a9": {
      profile: {
        everHadUserKey: true,
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

function rollbackJSON() {
  return {
    "user_c493ed01-4e08-4e88-abc7-332f380ca760_crypto_everHadUserKey": false,
    "user_23e61a5f-2ece-4f5e-b499-f0bc489482a9_crypto_everHadUserKey": true,
    "user_fd005ea6-a16a-45ef-ba4a-a194269bfd73_crypto_everHadUserKey": false,
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: [
      "c493ed01-4e08-4e88-abc7-332f380ca760",
      "23e61a5f-2ece-4f5e-b499-f0bc489482a9",
      "fd005ea6-a16a-45ef-ba4a-a194269bfd73",
    ],
    "c493ed01-4e08-4e88-abc7-332f380ca760": {
      profile: {
        everHadUserKey: false,
        otherStuff: "overStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "23e61a5f-2ece-4f5e-b499-f0bc489482a9": {
      profile: {
        everHadUserKey: true,
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

describe("EverHadUserKeyMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: EverHadUserKeyMigrator;
  const keyDefinitionLike = {
    key: "everHadUserKey",
    stateDefinition: {
      name: "crypto",
    },
  };

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 9);
      sut = new EverHadUserKeyMigrator(9, 10);
    });

    it("should remove everHadUserKey from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("c493ed01-4e08-4e88-abc7-332f380ca760", {
        profile: {
          otherStuff: "overStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.set).toHaveBeenCalledWith("23e61a5f-2ece-4f5e-b499-f0bc489482a9", {
        profile: {
          otherStuff: "otherStuff4",
        },
        otherStuff: "otherStuff5",
      });
    });

    it("should set everHadUserKey provider value for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(
        "c493ed01-4e08-4e88-abc7-332f380ca760",
        keyDefinitionLike,
        false,
      );

      expect(helper.setToUser).toHaveBeenCalledWith(
        "23e61a5f-2ece-4f5e-b499-f0bc489482a9",
        keyDefinitionLike,
        true,
      );

      expect(helper.setToUser).toHaveBeenCalledWith(
        "fd005ea6-a16a-45ef-ba4a-a194269bfd73",
        keyDefinitionLike,
        false,
      );
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 10);
      sut = new EverHadUserKeyMigrator(9, 10);
    });

    it.each([
      "c493ed01-4e08-4e88-abc7-332f380ca760",
      "23e61a5f-2ece-4f5e-b499-f0bc489482a9",
      "fd005ea6-a16a-45ef-ba4a-a194269bfd73",
    ])("should null out new values", async (userId) => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(userId, keyDefinitionLike, null);
    });

    it("should add explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("c493ed01-4e08-4e88-abc7-332f380ca760", {
        profile: {
          everHadUserKey: false,
          otherStuff: "overStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.set).toHaveBeenCalledWith("23e61a5f-2ece-4f5e-b499-f0bc489482a9", {
        profile: {
          everHadUserKey: true,
          otherStuff: "otherStuff4",
        },
        otherStuff: "otherStuff5",
      });
    });

    it("should not try to restore values to missing accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).not.toHaveBeenCalledWith("fd005ea6-a16a-45ef-ba4a-a194269bfd73", any());
    });
  });
});
