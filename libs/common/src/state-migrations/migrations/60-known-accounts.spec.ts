import { MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import {
  ACCOUNT_ACCOUNTS,
  ACCOUNT_ACTIVE_ACCOUNT_ID,
  ACCOUNT_ACTIVITY,
  KnownAccountsMigrator,
} from "./60-known-accounts";

const migrateJson = () => {
  return {
    authenticatedAccounts: ["user1", "user2"],
    activeUserId: "user1",
    user1: {
      profile: {
        email: "user1",
        name: "User 1",
        emailVerified: true,
      },
    },
    user2: {
      profile: {
        email: "",
        emailVerified: false,
      },
    },
    accountActivity: {
      user1: 1609459200000, // 2021-01-01
      user2: 1609545600000, // 2021-01-02
    },
  };
};

const rollbackJson = () => {
  return {
    user1: {
      profile: {
        email: "user1",
        name: "User 1",
        emailVerified: true,
      },
    },
    user2: {
      profile: {
        email: "",
        emailVerified: false,
      },
    },
    global_account_accounts: {
      user1: {
        email: "user1",
        name: "User 1",
        emailVerified: true,
      },
      user2: {
        email: "",
        emailVerified: false,
      },
    },
    global_account_activeAccountId: "user1",
    global_account_activity: {
      user1: "2021-01-01T00:00:00.000Z",
      user2: "2021-01-02T00:00:00.000Z",
    },
  };
};

describe("ReplicateKnownAccounts", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: KnownAccountsMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(migrateJson(), 59);
      sut = new KnownAccountsMigrator(59, 60);
    });

    it("migrates accounts", async () => {
      await sut.migrate(helper);
      expect(helper.setToGlobal).toHaveBeenCalledWith(ACCOUNT_ACCOUNTS, {
        user1: {
          email: "user1",
          name: "User 1",
          emailVerified: true,
        },
        user2: {
          email: "",
          emailVerified: false,
          name: undefined,
        },
      });
      expect(helper.remove).toHaveBeenCalledWith("authenticatedAccounts");
    });

    it("migrates active account it", async () => {
      await sut.migrate(helper);
      expect(helper.setToGlobal).toHaveBeenCalledWith(ACCOUNT_ACTIVE_ACCOUNT_ID, "user1");
      expect(helper.remove).toHaveBeenCalledWith("activeUserId");
    });

    it("migrates account activity", async () => {
      await sut.migrate(helper);
      expect(helper.setToGlobal).toHaveBeenCalledWith(ACCOUNT_ACTIVITY, {
        user1: '"2021-01-01T00:00:00.000Z"',
        user2: '"2021-01-02T00:00:00.000Z"',
      });
      expect(helper.remove).toHaveBeenCalledWith("accountActivity");
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJson(), 60);
      sut = new KnownAccountsMigrator(59, 60);
    });

    it("rolls back authenticated accounts", async () => {
      await sut.rollback(helper);
      expect(helper.set).toHaveBeenCalledWith("authenticatedAccounts", ["user1", "user2"]);
      expect(helper.removeFromGlobal).toHaveBeenCalledWith(ACCOUNT_ACCOUNTS);
    });

    it("rolls back active account id", async () => {
      await sut.rollback(helper);
      expect(helper.set).toHaveBeenCalledWith("activeUserId", "user1");
      expect(helper.removeFromGlobal).toHaveBeenCalledWith(ACCOUNT_ACTIVE_ACCOUNT_ID);
    });

    it("rolls back account activity", async () => {
      await sut.rollback(helper);
      expect(helper.set).toHaveBeenCalledWith("accountActivity", {
        user1: 1609459200000,
        user2: 1609545600000,
      });
      expect(helper.removeFromGlobal).toHaveBeenCalledWith(ACCOUNT_ACTIVITY);
    });
  });
});
