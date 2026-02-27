import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { PolicyMigrator } from "./30-move-policy-state-to-state-provider";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      data: {
        policies: {
          encrypted: {
            "policy-1": {
              id: "policy-1",
              organizationId: "fe1ff6ef-d2d4-49f3-9c07-b0c7013998f9",
              type: 9, // max vault timeout
              enabled: true,
              data: {
                hours: 1,
                minutes: 30,
                action: "lock",
              },
            },
            "policy-2": {
              id: "policy-2",
              organizationId: "5f277723-6391-4b5c-add9-b0c200ee6967",
              type: 3, // single org
              enabled: true,
            },
          },
        },
        otherStuff: "otherStuff2",
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
    "user_user-1_policies_policies": {
      "policy-1": {
        id: "policy-1",
        organizationId: "fe1ff6ef-d2d4-49f3-9c07-b0c7013998f9",
        type: 9,
        enabled: true,
        data: {
          hours: 1,
          minutes: 30,
          action: "lock",
        },
      },
      "policy-2": {
        id: "policy-2",
        organizationId: "5f277723-6391-4b5c-add9-b0c200ee6967",
        type: 3,
        enabled: true,
      },
    },
    "user_user-2_policies_policies": null as any,
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      data: {
        otherStuff: "otherStuff2",
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

describe("PoliciesMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: PolicyMigrator;
  const keyDefinitionLike = {
    key: "policies",
    stateDefinition: {
      name: "policies",
    },
  };

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 22);
      sut = new PolicyMigrator(29, 30);
    });

    it("should remove policies from all old accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        data: {
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should set policies value in StateProvider framework for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user-1", keyDefinitionLike, {
        "policy-1": {
          id: "policy-1",
          organizationId: "fe1ff6ef-d2d4-49f3-9c07-b0c7013998f9",
          type: 9,
          enabled: true,
          data: {
            hours: 1,
            minutes: 30,
            action: "lock",
          },
        },
        "policy-2": {
          id: "policy-2",
          organizationId: "5f277723-6391-4b5c-add9-b0c200ee6967",
          type: 3,
          enabled: true,
        },
      });
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 23);
      sut = new PolicyMigrator(29, 30);
    });

    it.each(["user-1", "user-2"])("should null out new values", async (userId) => {
      await sut.rollback(helper);
      expect(helper.setToUser).toHaveBeenCalledWith(userId, keyDefinitionLike, null);
    });

    it("should add policy values back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalled();
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        data: {
          policies: {
            encrypted: {
              "policy-1": {
                id: "policy-1",
                organizationId: "fe1ff6ef-d2d4-49f3-9c07-b0c7013998f9",
                type: 9,
                enabled: true,
                data: {
                  hours: 1,
                  minutes: 30,
                  action: "lock",
                },
              },
              "policy-2": {
                id: "policy-2",
                organizationId: "5f277723-6391-4b5c-add9-b0c200ee6967",
                type: 3,
                enabled: true,
              },
            },
          },
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
