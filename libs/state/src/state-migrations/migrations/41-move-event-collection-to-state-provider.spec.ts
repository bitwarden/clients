import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { EventCollectionMigrator } from "./41-move-event-collection-to-state-provider";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      data: {
        eventCollection: [
          {
            type: 1107,
            cipherId: "5154f91d-c469-4d23-aefa-b12a0140d684",
            organizationId: "278d5f91-835b-459a-a229-b11e01336d6d",
            date: "2024-03-05T21:59:50.169Z",
          },
          {
            type: 1107,
            cipherId: "ed4661bd-412c-4b05-89a2-b12a01697a2c",
            organizationId: "278d5f91-835b-459a-a229-b11e01336d6d",
            date: "2024-03-05T22:02:06.089Z",
          },
        ],
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
    "user_user-1_eventCollection_eventCollection": [
      {
        type: 1107,
        cipherId: "5154f91d-c469-4d23-aefa-b12a0140d684",
        organizationId: "278d5f91-835b-459a-a229-b11e01336d6d",
        date: "2024-03-05T21:59:50.169Z",
      },
      {
        type: 1107,
        cipherId: "ed4661bd-412c-4b05-89a2-b12a01697a2c",
        organizationId: "278d5f91-835b-459a-a229-b11e01336d6d",
        date: "2024-03-05T22:02:06.089Z",
      },
    ],
    "user_user-2_eventCollection_data": null as any,
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

describe("EventCollectionMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: EventCollectionMigrator;
  const keyDefinitionLike = {
    stateDefinition: {
      name: "eventCollection",
    },
    key: "eventCollection",
  };

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 40);
      sut = new EventCollectionMigrator(40, 41);
    });

    it("should remove event collections from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        data: {
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should set event collections for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user-1", keyDefinitionLike, [
        {
          type: 1107,
          cipherId: "5154f91d-c469-4d23-aefa-b12a0140d684",
          organizationId: "278d5f91-835b-459a-a229-b11e01336d6d",
          date: "2024-03-05T21:59:50.169Z",
        },
        {
          type: 1107,
          cipherId: "ed4661bd-412c-4b05-89a2-b12a01697a2c",
          organizationId: "278d5f91-835b-459a-a229-b11e01336d6d",
          date: "2024-03-05T22:02:06.089Z",
        },
      ]);
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 41);
      sut = new EventCollectionMigrator(40, 41);
    });

    it.each(["user-1", "user-2"])("should null out new values", async (userId) => {
      await sut.rollback(helper);
      expect(helper.setToUser).toHaveBeenCalledWith(userId, keyDefinitionLike, null);
    });

    it("should add event collection values back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalled();
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        data: {
          eventCollection: [
            {
              type: 1107,
              cipherId: "5154f91d-c469-4d23-aefa-b12a0140d684",
              organizationId: "278d5f91-835b-459a-a229-b11e01336d6d",
              date: "2024-03-05T21:59:50.169Z",
            },
            {
              type: 1107,
              cipherId: "ed4661bd-412c-4b05-89a2-b12a01697a2c",
              organizationId: "278d5f91-835b-459a-a229-b11e01336d6d",
              date: "2024-03-05T22:02:06.089Z",
            },
          ],
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
