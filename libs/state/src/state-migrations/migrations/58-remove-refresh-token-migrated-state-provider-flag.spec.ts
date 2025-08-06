import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import {
  REFRESH_TOKEN_MIGRATED_TO_SECURE_STORAGE,
  RemoveRefreshTokenMigratedFlagMigrator,
} from "./58-remove-refresh-token-migrated-state-provider-flag";

// Represents data in state service pre-migration
function preMigrationJson() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user1", "user2", "user3"],

    user_user1_token_refreshTokenMigratedToSecureStorage: true,
    user_user2_token_refreshTokenMigratedToSecureStorage: false,
  };
}

function rollbackJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user1", "user2", "user3"],
  };
}

describe("RemoveRefreshTokenMigratedFlagMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: RemoveRefreshTokenMigratedFlagMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(preMigrationJson(), 57);
      sut = new RemoveRefreshTokenMigratedFlagMigrator(57, 58);
    });

    it("should remove refreshTokenMigratedToSecureStorage from state provider for all accounts that have it", async () => {
      await sut.migrate(helper);

      expect(helper.removeFromUser).toHaveBeenCalledWith(
        "user1",
        REFRESH_TOKEN_MIGRATED_TO_SECURE_STORAGE,
      );
      expect(helper.removeFromUser).toHaveBeenCalledWith(
        "user2",
        REFRESH_TOKEN_MIGRATED_TO_SECURE_STORAGE,
      );

      expect(helper.removeFromUser).toHaveBeenCalledTimes(2);

      expect(helper.removeFromUser).not.toHaveBeenCalledWith("user3", any());
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 58);
      sut = new RemoveRefreshTokenMigratedFlagMigrator(57, 58);
    });

    it("should not add data back and throw IRREVERSIBLE error on call", async () => {
      await expect(sut.rollback(helper)).rejects.toThrow(IRREVERSIBLE);
    });
  });
});
