import { any, MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { ProviderMigrator } from "./28-move-provider-state-to-state-provider";

function exampleProvider1() {
  return JSON.stringify({
    id: "id",
    name: "name",
    status: 0,
    type: 0,
    enabled: true,
    useEvents: true,
  });
}

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      data: {
        providers: {
          "provider-id-1": exampleProvider1(),
          "provider-id-2": {
            // ...
          },
        },
        otherStuff: "overStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      data: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

function rollbackJSON() {
  return {
    "user_user-1_providers_providers": {
      "provider-id-1": exampleProvider1(),
      "provider-id-2": {
        // ...
      },
    },
    "user_user-2_providers_providers": null as any,
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      data: {
        otherStuff: "overStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      data: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

describe("ProviderMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: ProviderMigrator;
  const keyDefinitionLike = {
    key: "providers",
    stateDefinition: {
      name: "providers",
    },
  };

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 28);
      sut = new ProviderMigrator(27, 28);
    });

    it("should remove providers from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        data: {
          otherStuff: "overStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should set providers value for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user-1", keyDefinitionLike, {
        "provider-id-1": exampleProvider1(),
        "provider-id-2": {
          // ...
        },
      });
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 27);
      sut = new ProviderMigrator(27, 28);
    });

    it.each(["user-1", "user-2"])("should null out new values", async (userId) => {
      await sut.rollback(helper);
      expect(helper.setToUser).toHaveBeenCalledWith(userId, keyDefinitionLike, null);
    });

    it("should add explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("user-1", {
        data: {
          providers: {
            "provider-id-1": exampleProvider1(),
            "provider-id-2": {
              // ...
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
