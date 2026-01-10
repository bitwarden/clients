import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import {
  EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL,
  ACCESS_TOKEN_DISK,
  REFRESH_TOKEN_DISK,
  API_KEY_CLIENT_ID_DISK,
  API_KEY_CLIENT_SECRET_DISK,
  TokenServiceStateProviderMigrator,
} from "./38-migrate-token-svc-to-state-provider";

// Represents data in state service pre-migration
function preMigrationJson() {
  return {
    global: {
      twoFactorToken: "twoFactorToken",
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user1", "user2", "user3"],
    user1: {
      tokens: {
        accessToken: "accessToken",
        refreshToken: "refreshToken",
        otherStuff: "overStuff2",
      },
      profile: {
        apiKeyClientId: "apiKeyClientId",
        email: "user1Email",
        otherStuff: "overStuff3",
      },
      keys: {
        apiKeyClientSecret: "apiKeyClientSecret",
        otherStuff: "overStuff4",
      },
      otherStuff: "otherStuff5",
    },
    user2: {
      tokens: {
        // no tokens to migrate
        otherStuff: "overStuff2",
      },
      profile: {
        // no apiKeyClientId to migrate
        otherStuff: "overStuff3",
        email: "user2Email",
      },
      keys: {
        // no apiKeyClientSecret to migrate
        otherStuff: "overStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

function rollbackJSON() {
  return {
    // User specific state provider data
    // use pattern user_{userId}_{stateDefinitionName}_{keyDefinitionKey} for user data

    // User1 migrated data
    user_user1_token_accessToken: "accessToken",
    user_user1_token_refreshToken: "refreshToken",
    user_user1_token_apiKeyClientId: "apiKeyClientId",
    user_user1_token_apiKeyClientSecret: "apiKeyClientSecret",

    // User2 migrated data
    user_user2_token_accessToken: null as any,
    user_user2_token_refreshToken: null as any,
    user_user2_token_apiKeyClientId: null as any,
    user_user2_token_apiKeyClientSecret: null as any,

    // Global state provider data
    // use pattern global_{stateDefinitionName}_{keyDefinitionKey} for global data
    global_tokenDiskLocal_emailTwoFactorTokenRecord: {
      user1Email: "twoFactorToken",
      user2Email: "twoFactorToken",
    },

    global: {
      // no longer has twoFactorToken
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user1", "user2", "user3"],
    user1: {
      tokens: {
        otherStuff: "overStuff2",
      },
      profile: {
        email: "user1Email",
        otherStuff: "overStuff3",
      },
      keys: {
        otherStuff: "overStuff4",
      },
      otherStuff: "otherStuff5",
    },
    user2: {
      tokens: {
        otherStuff: "overStuff2",
      },
      profile: {
        email: "user2Email",
        otherStuff: "overStuff3",
      },
      keys: {
        otherStuff: "overStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

describe("TokenServiceStateProviderMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: TokenServiceStateProviderMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(preMigrationJson(), 37);
      sut = new TokenServiceStateProviderMigrator(37, 38);
    });

    describe("Session storage", () => {
      it("should remove state service data from all accounts that have it", async () => {
        await sut.migrate(helper);

        expect(helper.set).toHaveBeenCalledWith("user1", {
          tokens: {
            otherStuff: "overStuff2",
          },
          profile: {
            email: "user1Email",
            otherStuff: "overStuff3",
          },
          keys: {
            otherStuff: "overStuff4",
          },
          otherStuff: "otherStuff5",
        });

        expect(helper.set).toHaveBeenCalledTimes(2);
        expect(helper.set).not.toHaveBeenCalledWith("user2", any());
        expect(helper.set).not.toHaveBeenCalledWith("user3", any());
      });

      it("should migrate data to state providers for defined accounts that have the data", async () => {
        await sut.migrate(helper);

        // Two factor Token Migration
        expect(helper.setToGlobal).toHaveBeenLastCalledWith(
          EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL,
          {
            user1Email: "twoFactorToken",
            user2Email: "twoFactorToken",
          },
        );
        expect(helper.setToGlobal).toHaveBeenCalledTimes(1);

        expect(helper.setToUser).toHaveBeenCalledWith("user1", ACCESS_TOKEN_DISK, "accessToken");
        expect(helper.setToUser).toHaveBeenCalledWith("user1", REFRESH_TOKEN_DISK, "refreshToken");
        expect(helper.setToUser).toHaveBeenCalledWith(
          "user1",
          API_KEY_CLIENT_ID_DISK,
          "apiKeyClientId",
        );
        expect(helper.setToUser).toHaveBeenCalledWith(
          "user1",
          API_KEY_CLIENT_SECRET_DISK,
          "apiKeyClientSecret",
        );

        expect(helper.setToUser).not.toHaveBeenCalledWith("user2", ACCESS_TOKEN_DISK, any());
        expect(helper.setToUser).not.toHaveBeenCalledWith("user2", REFRESH_TOKEN_DISK, any());
        expect(helper.setToUser).not.toHaveBeenCalledWith("user2", API_KEY_CLIENT_ID_DISK, any());
        expect(helper.setToUser).not.toHaveBeenCalledWith(
          "user2",
          API_KEY_CLIENT_SECRET_DISK,
          any(),
        );

        // Expect that we didn't migrate anything to user 3

        expect(helper.setToUser).not.toHaveBeenCalledWith("user3", ACCESS_TOKEN_DISK, any());
        expect(helper.setToUser).not.toHaveBeenCalledWith("user3", REFRESH_TOKEN_DISK, any());
        expect(helper.setToUser).not.toHaveBeenCalledWith("user3", API_KEY_CLIENT_ID_DISK, any());
        expect(helper.setToUser).not.toHaveBeenCalledWith(
          "user3",
          API_KEY_CLIENT_SECRET_DISK,
          any(),
        );
      });
    });
    describe("Local storage", () => {
      beforeEach(() => {
        helper = mockMigrationHelper(preMigrationJson(), 37, "web-disk-local");
      });
      it("should remove state service data from all accounts that have it", async () => {
        await sut.migrate(helper);

        expect(helper.set).toHaveBeenCalledWith("user1", {
          tokens: {
            otherStuff: "overStuff2",
          },
          profile: {
            email: "user1Email",
            otherStuff: "overStuff3",
          },
          keys: {
            otherStuff: "overStuff4",
          },
          otherStuff: "otherStuff5",
        });

        expect(helper.set).toHaveBeenCalledTimes(2);
        expect(helper.set).not.toHaveBeenCalledWith("user2", any());
        expect(helper.set).not.toHaveBeenCalledWith("user3", any());
      });

      it("should not migrate any data to local storage", async () => {
        await sut.migrate(helper);

        expect(helper.setToUser).not.toHaveBeenCalled();
      });
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 38);
      sut = new TokenServiceStateProviderMigrator(37, 38);
    });

    it("should null out newly migrated entries in state provider framework", async () => {
      await sut.rollback(helper);

      expect(helper.setToGlobal).toHaveBeenCalledWith(
        EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL,
        null,
      );

      expect(helper.setToUser).toHaveBeenCalledWith("user1", ACCESS_TOKEN_DISK, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user1", REFRESH_TOKEN_DISK, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user1", API_KEY_CLIENT_ID_DISK, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user1", API_KEY_CLIENT_SECRET_DISK, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user2", ACCESS_TOKEN_DISK, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user2", REFRESH_TOKEN_DISK, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user2", API_KEY_CLIENT_ID_DISK, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user2", API_KEY_CLIENT_SECRET_DISK, null);

      expect(helper.setToUser).toHaveBeenCalledWith("user3", ACCESS_TOKEN_DISK, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user3", REFRESH_TOKEN_DISK, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user3", API_KEY_CLIENT_ID_DISK, null);
      expect(helper.setToUser).toHaveBeenCalledWith("user3", API_KEY_CLIENT_SECRET_DISK, null);
    });

    it("should add back data to all accounts that had migrated data (only user 1)", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("user1", {
        tokens: {
          accessToken: "accessToken",
          refreshToken: "refreshToken",
          otherStuff: "overStuff2",
        },
        profile: {
          apiKeyClientId: "apiKeyClientId",
          email: "user1Email",
          otherStuff: "overStuff3",
        },
        keys: {
          apiKeyClientSecret: "apiKeyClientSecret",
          otherStuff: "overStuff4",
        },
        otherStuff: "otherStuff5",
      });
    });

    it("should add back the global twoFactorToken", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("global", {
        twoFactorToken: "twoFactorToken",
        otherStuff: "otherStuff1",
      });
    });

    it("should not add data back if data wasn't migrated or acct doesn't exist", async () => {
      await sut.rollback(helper);

      // no data to add back for user2 (acct exists but no migrated data) and user3 (no acct)
      expect(helper.set).not.toHaveBeenCalledWith("user2", any());
      expect(helper.set).not.toHaveBeenCalledWith("user3", any());
    });
  });
});
