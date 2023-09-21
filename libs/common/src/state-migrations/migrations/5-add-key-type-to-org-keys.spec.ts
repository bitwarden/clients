import { MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { AddKeyTypeToOrgKeysMigrator } from "./5-add-key-type-to-org-keys";

function migrateExampleJSON() {
  return {
    global: {
      stateVersion: 4,
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: [
      "c493ed01-4e08-4e88-abc7-332f380ca760",
      "23e61a5f-2ece-4f5e-b499-f0bc489482a9",
    ],
    "c493ed01-4e08-4e88-abc7-332f380ca760": {
      keys: {
        organizationKeys: {
          encrypted: {
            orgOneId: "orgOneEncKey",
            orgTwoId: "orgTwoEncKey",
          },
        },
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
  };
}

function rollbackExampleJSON() {
  return {
    global: {
      stateVersion: 5,
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: [
      "c493ed01-4e08-4e88-abc7-332f380ca760",
      "23e61a5f-2ece-4f5e-b499-f0bc489482a9",
    ],
    "c493ed01-4e08-4e88-abc7-332f380ca760": {
      keys: {
        organizationKeys: {
          encrypted: {
            orgOneId: {
              type: "organization",
              key: "orgOneEncKey",
            },
            orgTwoId: {
              type: "organization",
              key: "orgTwoEncKey",
            },
          },
        },
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
  };
}

describe("AddKeyTypeToOrgKeysMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: AddKeyTypeToOrgKeysMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(migrateExampleJSON());
      sut = new AddKeyTypeToOrgKeysMigrator(4, 5);
    });

    it("should add organization type to organization keys", async () => {
      await sut.migrate(helper);

      expect(helper.set).toHaveBeenCalledWith("c493ed01-4e08-4e88-abc7-332f380ca760", {
        keys: {
          organizationKeys: {
            encrypted: {
              orgOneId: {
                type: "organization",
                key: "orgOneEncKey",
              },
              orgTwoId: {
                type: "organization",
                key: "orgTwoEncKey",
              },
            },
          },
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should update version", async () => {
      await sut.updateVersion(helper, "up");

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("global", {
        stateVersion: 5,
        otherStuff: "otherStuff1",
      });
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackExampleJSON());
      sut = new AddKeyTypeToOrgKeysMigrator(4, 5);
    });

    it("should remove type from orgainzation keys", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("c493ed01-4e08-4e88-abc7-332f380ca760", {
        keys: {
          organizationKeys: {
            encrypted: {
              orgOneId: "orgOneEncKey",
              orgTwoId: "orgTwoEncKey",
            },
          },
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should update version down", async () => {
      await sut.updateVersion(helper, "down");

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("global", {
        stateVersion: 4,
        otherStuff: "otherStuff1",
      });
    });
  });
});
