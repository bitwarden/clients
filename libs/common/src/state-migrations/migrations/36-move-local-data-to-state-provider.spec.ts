import { MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { LocalDataMigrator } from "./36-move-local-data-to-state-provider";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      localData: [
        {
          "6865ba55-7966-4d63-b743-b12000d49631": {
            lastUsedDate: 1708950970632,
          },
        },
        {
          "f895f099-6739-4cca-9d61-b12200d04bfa": {
            lastUsedDate: 1709031916943,
          },
        },
      ],
    },
    "user-2": {
      localData: {
        "fce9e7bf-bb3d-4650-897f-b12300f43541": {
          lastUsedDate: 1708950970632,
        },
        "ffb90bc2-a4ff-4571-b954-b12300f4207e": {
          lastUsedDate: 1709031916943,
        },
      },
    },
  };
}

function rollbackJSON() {
  return {
    authenticatedAccounts: ["user-1", "user-2"],
    "user-1": {
      localdata: [
        {
          "6865ba55-7966-4d63-b743-b12000d49631": {
            lastUsedDate: 1708950970632,
          },
          "f895f099-6739-4cca-9d61-b12200d04bfa": {
            lastUsedDate: 1709031916943,
          },
        },
      ],
    },
    "user-2": {
      localdata: [
        {
          "fce9e7bf-bb3d-4650-897f-b12300f43541": {
            lastUsedDate: 1708950970632,
          },
          "ffb90bc2-a4ff-4571-b954-b12300f4207e": {
            lastUsedDate: 1709031916943,
          },
        },
      ],
    },
  };
}

describe("LocalDataMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: LocalDataMigrator;
  const keyDefinitionLike = {
    key: "ciphers_disk",
    stateDefinition: {
      name: "localData",
    },
  };

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 36);
      sut = new LocalDataMigrator(35, 36);
    });

    it("should remove local data from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        localData: [
          {
            "6865ba55-7966-4d63-b743-b12000d49631": {
              lastUsedDate: 1708950970632,
            },
          },
          {
            "f895f099-6739-4cca-9d61-b12200d04bfa": {
              lastUsedDate: 1709031916943,
            },
          },
        ],
      });
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 36);
      sut = new LocalDataMigrator(35, 36);
    });

    it.each(["user-1", "user-2"])("should null out new values", async (userId) => {
      await sut.rollback(helper);
      expect(helper.setToUser).toHaveBeenCalledWith(userId, keyDefinitionLike, null);
    });
  });
});
