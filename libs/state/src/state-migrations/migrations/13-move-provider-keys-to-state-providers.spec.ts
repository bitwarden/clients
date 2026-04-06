import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { ProviderKeyMigrator } from "./13-move-provider-keys-to-state-providers";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
    "user-1": {
      keys: {
        providerKeys: {
          encrypted: {
            "provider-id-1": "provider-key-1",
            "provider-id-2": "provider-key-2",
          },
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
    "user_user-1_crypto_providerKeys": {
      "provider-id-1": "provider-key-1",
      "provider-id-2": "provider-key-2",
    },
    "user_user-2_crypto_providerKeys": null as any,
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

describe("ProviderKeysMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: ProviderKeyMigrator;
  const keyDefinitionLike = {
    key: "providerKeys",
    stateDefinition: {
      name: "crypto",
    },
  };

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 12);
      sut = new ProviderKeyMigrator(12, 13);
    });

    it("should remove providerKeys from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        keys: {
          otherStuff: "overStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should set providerKeys value for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(1);
      expect(helper.setToUser).toHaveBeenCalledWith("user-1", keyDefinitionLike, {
        "provider-id-1": "provider-key-1",
        "provider-id-2": "provider-key-2",
      });
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 13);
      sut = new ProviderKeyMigrator(12, 13);
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
          providerKeys: {
            encrypted: {
              "provider-id-1": "provider-key-1",
              "provider-id-2": "provider-key-2",
            },
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
