import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { OrganizationKeyMigrator } from "./11-move-org-keys-to-state-providers";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
    "user-1": {
      keys: {
        organizationKeys: {
          encrypted: {
            "org-id-1": {
              type: "organization",
              key: "org-key-1",
            },
            "org-id-2": {
              type: "provider",
              key: "org-key-2",
              providerId: "provider-id-2",
            },
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
    "user_user-1_crypto_organizationKeys": {
      "org-id-1": {
        type: "organization",
        key: "org-key-1",
      },
      "org-id-2": {
        type: "provider",
        key: "org-key-2",
        providerId: "provider-id-2",
      },
    },
    "user_user-2_crypto_organizationKeys": null as any,
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

describe("OrganizationKeysMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: OrganizationKeyMigrator;
  const keyDefinitionLike = {
    key: "organizationKeys",
    stateDefinition: {
      name: "crypto",
    },
  };

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 10);
      sut = new OrganizationKeyMigrator(10, 11);
    });

    it("should remove organizationKeys from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        keys: {
          otherStuff: "overStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should set organizationKeys value for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(1);
      expect(helper.setToUser).toHaveBeenCalledWith("user-1", keyDefinitionLike, {
        "org-id-1": {
          type: "organization",
          key: "org-key-1",
        },
        "org-id-2": {
          type: "provider",
          key: "org-key-2",
          providerId: "provider-id-2",
        },
      });
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 11);
      sut = new OrganizationKeyMigrator(10, 11);
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
          organizationKeys: {
            encrypted: {
              "org-id-1": {
                type: "organization",
                key: "org-key-1",
              },
              "org-id-2": {
                type: "provider",
                key: "org-key-2",
                providerId: "provider-id-2",
              },
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
