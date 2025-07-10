import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { CollectionMigrator } from "./21-move-collections-state-to-state-provider";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      data: {
        collections: {
          encrypted: {
            "877fef70-be32-439e-8678-b0d80125653d": {
              id: "877fef70-be32-439e-8678-b0d80125653d",
              organizationId: "fe1ff6ef-d2d4-49f3-9c07-b0c7013998f9",
              name: "2.MD9OMDsvYiU1CTSUxjHorw==|uFc4cZhnmQmK2LFCWbyeZg==|syk2d9JESeplxInLvP36BK5RhqS1c/i+ZQp5NR7EUA4=",
              externalId: "",
              readOnly: false,
              manage: true,
              hidePasswords: false,
            },
            "0d3fee82-3f81-434c-aed0-b0c200ee6c7a": {
              id: "0d3fee82-3f81-434c-aed0-b0c200ee6c7a",
              organizationId: "5f277723-6391-4b5c-add9-b0c200ee6967",
              name: "2.GxnXkIbBCGFr57F6lT7+Ow==|3ctMg95FKquG3l+qfv8BgvaCbYzMmuhnukCEHXhUukE=|cJRZWq05xjPBayUgx6P6gsbtNVLi8exQwo8F1SfqQQ4=",
              externalId: "",
              readOnly: false,
              manage: false,
              hidePasswords: false,
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
    "user_user-1_collection_collections": {
      "877fef70-be32-439e-8678-b0d80125653d": {
        id: "877fef70-be32-439e-8678-b0d80125653d",
        organizationId: "fe1ff6ef-d2d4-49f3-9c07-b0c7013998f9",
        name: "2.MD9OMDsvYiU1CTSUxjHorw==|uFc4cZhnmQmK2LFCWbyeZg==|syk2d9JESeplxInLvP36BK5RhqS1c/i+ZQp5NR7EUA4=",
        externalId: "",
        readOnly: false,
        manage: true,
        hidePasswords: false,
      },
      "0d3fee82-3f81-434c-aed0-b0c200ee6c7a": {
        id: "0d3fee82-3f81-434c-aed0-b0c200ee6c7a",
        organizationId: "5f277723-6391-4b5c-add9-b0c200ee6967",
        name: "2.GxnXkIbBCGFr57F6lT7+Ow==|3ctMg95FKquG3l+qfv8BgvaCbYzMmuhnukCEHXhUukE=|cJRZWq05xjPBayUgx6P6gsbtNVLi8exQwo8F1SfqQQ4=",
        externalId: "",
        readOnly: false,
        manage: false,
        hidePasswords: false,
      },
    },
    "user_user-2_collection_data": null as any,
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

describe("CollectionMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: CollectionMigrator;
  const keyDefinitionLike = {
    key: "collections",
    stateDefinition: {
      name: "collection",
    },
  };

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 20);
      sut = new CollectionMigrator(20, 21);
    });

    it("should remove collections from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        data: {
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should set collections value for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user-1", keyDefinitionLike, {
        "877fef70-be32-439e-8678-b0d80125653d": {
          id: "877fef70-be32-439e-8678-b0d80125653d",
          organizationId: "fe1ff6ef-d2d4-49f3-9c07-b0c7013998f9",
          name: "2.MD9OMDsvYiU1CTSUxjHorw==|uFc4cZhnmQmK2LFCWbyeZg==|syk2d9JESeplxInLvP36BK5RhqS1c/i+ZQp5NR7EUA4=",
          externalId: "",
          readOnly: false,
          manage: true,
          hidePasswords: false,
        },
        "0d3fee82-3f81-434c-aed0-b0c200ee6c7a": {
          id: "0d3fee82-3f81-434c-aed0-b0c200ee6c7a",
          organizationId: "5f277723-6391-4b5c-add9-b0c200ee6967",
          name: "2.GxnXkIbBCGFr57F6lT7+Ow==|3ctMg95FKquG3l+qfv8BgvaCbYzMmuhnukCEHXhUukE=|cJRZWq05xjPBayUgx6P6gsbtNVLi8exQwo8F1SfqQQ4=",
          externalId: "",
          readOnly: false,
          manage: false,
          hidePasswords: false,
        },
      });
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 21);
      sut = new CollectionMigrator(20, 21);
    });

    it.each(["user-1", "user-2"])("should null out new values", async (userId) => {
      await sut.rollback(helper);
      expect(helper.setToUser).toHaveBeenCalledWith(userId, keyDefinitionLike, null);
    });

    it("should add collection values back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalled();
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        data: {
          collections: {
            encrypted: {
              "877fef70-be32-439e-8678-b0d80125653d": {
                id: "877fef70-be32-439e-8678-b0d80125653d",
                organizationId: "fe1ff6ef-d2d4-49f3-9c07-b0c7013998f9",
                name: "2.MD9OMDsvYiU1CTSUxjHorw==|uFc4cZhnmQmK2LFCWbyeZg==|syk2d9JESeplxInLvP36BK5RhqS1c/i+ZQp5NR7EUA4=",
                externalId: "",
                readOnly: false,
                manage: true,
                hidePasswords: false,
              },
              "0d3fee82-3f81-434c-aed0-b0c200ee6c7a": {
                id: "0d3fee82-3f81-434c-aed0-b0c200ee6c7a",
                organizationId: "5f277723-6391-4b5c-add9-b0c200ee6967",
                name: "2.GxnXkIbBCGFr57F6lT7+Ow==|3ctMg95FKquG3l+qfv8BgvaCbYzMmuhnukCEHXhUukE=|cJRZWq05xjPBayUgx6P6gsbtNVLi8exQwo8F1SfqQQ4=",
                externalId: "",
                readOnly: false,
                manage: false,
                hidePasswords: false,
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
