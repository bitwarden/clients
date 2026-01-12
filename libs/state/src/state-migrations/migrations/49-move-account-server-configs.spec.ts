import { runMigrator } from "../migration-helper.spec";

import { AccountServerConfigMigrator } from "./49-move-account-server-configs";

describe("AccountServerConfigMigrator", () => {
  const migrator = new AccountServerConfigMigrator(48, 49);

  describe("all data", () => {
    function toMigrate() {
      return {
        authenticatedAccounts: ["user1", "user2"],
        user1: {
          settings: {
            serverConfig: {
              config: "user1 server config",
            },
          },
        },
        user2: {
          settings: {
            serverConfig: {
              config: "user2 server config",
            },
          },
        },
      };
    }

    function migrated() {
      return {
        authenticatedAccounts: ["user1", "user2"],

        user1: {
          settings: {},
        },
        user2: {
          settings: {},
        },
        user_user1_config_serverConfig: {
          config: "user1 server config",
        },
        user_user2_config_serverConfig: {
          config: "user2 server config",
        },
      };
    }

    function rolledBack(previous: object) {
      return {
        ...previous,
        user_user1_config_serverConfig: null as unknown,
        user_user2_config_serverConfig: null as unknown,
      };
    }

    it("migrates", async () => {
      const output = await runMigrator(migrator, toMigrate(), "migrate");
      expect(output).toEqual(migrated());
    });

    it("rolls back", async () => {
      const output = await runMigrator(migrator, migrated(), "rollback");
      expect(output).toEqual(rolledBack(toMigrate()));
    });
  });

  describe("missing parts", () => {
    function toMigrate() {
      return {
        authenticatedAccounts: ["user1", "user2"],
        user1: {
          settings: {
            serverConfig: {
              config: "user1 server config",
            },
          },
        },
        user2: null as unknown,
      };
    }

    function migrated() {
      return {
        authenticatedAccounts: ["user1", "user2"],
        user1: {
          settings: {},
        },
        user2: null as unknown,
        user_user1_config_serverConfig: {
          config: "user1 server config",
        },
      };
    }

    function rollback(previous: object) {
      return {
        ...previous,
        user_user1_config_serverConfig: null as unknown,
      };
    }

    it("migrates", async () => {
      const output = await runMigrator(migrator, toMigrate(), "migrate");
      expect(output).toEqual(migrated());
    });

    it("rolls back", async () => {
      const output = await runMigrator(migrator, migrated(), "rollback");
      expect(output).toEqual(rollback(toMigrate()));
    });
  });
});
