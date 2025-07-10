import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { PrivateKeyMigrator } from "./20-move-private-key-to-state-providers";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
    "user-1": {
      keys: {
        privateKey: {
          encrypted: "user-1-encrypted-private-key",
        },
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
    "user_user-1_crypto_privateKey": "encrypted-private-key",
    "user_user-2_crypto_privateKey": null as any,
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
    "user-1": {
      keys: {
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

describe("privateKeyMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: PrivateKeyMigrator;
  const keyDefinitionLike = {
    key: "privateKey",
    stateDefinition: {
      name: "crypto",
    },
  };

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 19);
      sut = new PrivateKeyMigrator(19, 20);
    });

    it("should remove privateKey from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        keys: {
          otherStuff: "overStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should set privateKey value for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(1);
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        keyDefinitionLike,
        "user-1-encrypted-private-key",
      );
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 20);
      sut = new PrivateKeyMigrator(19, 20);
    });

    it.each(["user-1", "user-2", "user-3"])("should null out new values %s", async (userId) => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(userId, keyDefinitionLike, null);
    });

    it("should add explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        keys: {
          privateKey: {
            encrypted: "encrypted-private-key",
          },
          otherStuff: "overStuff2",
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
