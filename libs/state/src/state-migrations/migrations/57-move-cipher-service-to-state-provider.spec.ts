import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import {
  CIPHERS_DISK,
  CIPHERS_DISK_LOCAL,
  CipherServiceMigrator,
} from "./57-move-cipher-service-to-state-provider";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user1", "user2"],
    user1: {
      data: {
        localData: {
          "6865ba55-7966-4d63-b743-b12000d49631": {
            lastUsedDate: 1708950970632,
          },
          "f895f099-6739-4cca-9d61-b12200d04bfa": {
            lastUsedDate: 1709031916943,
          },
        },
        ciphers: {
          encrypted: {
            "cipher-id-10": {
              id: "cipher-id-10",
            },
            "cipher-id-11": {
              id: "cipher-id-11",
            },
          },
        },
      },
    },
    user2: {
      data: {
        otherStuff: "otherStuff5",
      },
    },
  };
}

function rollbackJSON() {
  return {
    user_user1_ciphersLocal_localData: {
      "6865ba55-7966-4d63-b743-b12000d49631": {
        lastUsedDate: 1708950970632,
      },
      "f895f099-6739-4cca-9d61-b12200d04bfa": {
        lastUsedDate: 1709031916943,
      },
    },
    user_user1_ciphers_ciphers: {
      "cipher-id-10": {
        id: "cipher-id-10",
      },
      "cipher-id-11": {
        id: "cipher-id-11",
      },
    },
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user1", "user2"],
    user1: {
      data: {},
    },
    user2: {
      data: {
        localData: {
          otherStuff: "otherStuff3",
        },
        ciphers: {
          otherStuff: "otherStuff4",
        },
        otherStuff: "otherStuff5",
      },
    },
  };
}

describe("CipherServiceMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: CipherServiceMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 56);
      sut = new CipherServiceMigrator(56, 57);
    });

    it("should remove local data and ciphers from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("user1", {
        data: {},
      });
    });

    it("should migrate localData and ciphers to state provider for accounts that have the data", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("user1", CIPHERS_DISK_LOCAL, {
        "6865ba55-7966-4d63-b743-b12000d49631": {
          lastUsedDate: 1708950970632,
        },
        "f895f099-6739-4cca-9d61-b12200d04bfa": {
          lastUsedDate: 1709031916943,
        },
      });
      expect(helper.setToUser).toHaveBeenCalledWith("user1", CIPHERS_DISK, {
        "cipher-id-10": {
          id: "cipher-id-10",
        },
        "cipher-id-11": {
          id: "cipher-id-11",
        },
      });

      expect(helper.setToUser).not.toHaveBeenCalledWith("user2", CIPHERS_DISK_LOCAL, any());
      expect(helper.setToUser).not.toHaveBeenCalledWith("user2", CIPHERS_DISK, any());
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 57);
      sut = new CipherServiceMigrator(56, 57);
    });

    it.each(["user1", "user2"])("should null out new values", async (userId) => {
      await sut.rollback(helper);
      expect(helper.setToUser).toHaveBeenCalledWith(userId, CIPHERS_DISK_LOCAL, null);
      expect(helper.setToUser).toHaveBeenCalledWith(userId, CIPHERS_DISK, null);
    });

    it("should add back localData and ciphers to all accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("user1", {
        data: {
          localData: {
            "6865ba55-7966-4d63-b743-b12000d49631": {
              lastUsedDate: 1708950970632,
            },
            "f895f099-6739-4cca-9d61-b12200d04bfa": {
              lastUsedDate: 1709031916943,
            },
          },
          ciphers: {
            encrypted: {
              "cipher-id-10": {
                id: "cipher-id-10",
              },
              "cipher-id-11": {
                id: "cipher-id-11",
              },
            },
          },
        },
      });
    });

    it("should not add data back if data wasn't migrated or acct doesn't exist", async () => {
      await sut.rollback(helper);

      expect(helper.set).not.toHaveBeenCalledWith("user2", any());
    });
  });
});
