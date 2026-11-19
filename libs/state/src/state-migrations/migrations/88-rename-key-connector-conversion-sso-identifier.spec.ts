import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { RenameKeyConnectorConversionSsoIdentifier } from "./88-rename-key-connector-conversion-sso-identifier";

describe("RenameKeyConnectorConversionSsoIdentifier", () => {
  const sut = new RenameKeyConnectorConversionSsoIdentifier(87, 88);

  const accounts = {
    user1: { email: "user1@email.com", name: "User 1", emailVerified: true },
    user2: { email: "user2@email.com", name: "User 2", emailVerified: true },
  };

  const kdfConfig = { kdfType: 0, iterations: 600000 };
  const keyConnectorUrl = "https://key-connector.example.com";

  describe("migrate", () => {
    it("moves organizationId to organizationSsoIdentifier and keeps the other properties", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: accounts,
        user_user1_keyConnector_newSsoUserKeyConnectorConversion: {
          kdfConfig,
          keyConnectorUrl,
          organizationId: "sso-identifier",
        },
      });

      expect(output).toEqual({
        global_account_accounts: accounts,
        user_user1_keyConnector_newSsoUserKeyConnectorConversion: {
          kdfConfig,
          keyConnectorUrl,
          organizationSsoIdentifier: "sso-identifier",
        },
      });
    });

    it("migrates each account independently", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: accounts,
        user_user1_keyConnector_newSsoUserKeyConnectorConversion: {
          kdfConfig,
          keyConnectorUrl,
          organizationId: "sso-identifier-1",
        },
        user_user2_keyConnector_newSsoUserKeyConnectorConversion: {
          kdfConfig,
          keyConnectorUrl,
          organizationId: "sso-identifier-2",
        },
      });

      expect(output).toEqual({
        global_account_accounts: accounts,
        user_user1_keyConnector_newSsoUserKeyConnectorConversion: {
          kdfConfig,
          keyConnectorUrl,
          organizationSsoIdentifier: "sso-identifier-1",
        },
        user_user2_keyConnector_newSsoUserKeyConnectorConversion: {
          kdfConfig,
          keyConnectorUrl,
          organizationSsoIdentifier: "sso-identifier-2",
        },
      });
    });

    it("leaves data that already uses organizationSsoIdentifier unchanged", async () => {
      const input = {
        global_account_accounts: accounts,
        user_user1_keyConnector_newSsoUserKeyConnectorConversion: {
          kdfConfig,
          keyConnectorUrl,
          organizationSsoIdentifier: "sso-identifier",
        },
      };

      const output = await runMigrator(sut, input);

      expect(output).toEqual(input);
    });

    it("does nothing when no conversion data exists", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: accounts,
        user_user1_keyConnector_newSsoUserKeyConnectorConversion: null,
      });

      expect(output).toEqual({
        global_account_accounts: accounts,
        user_user1_keyConnector_newSsoUserKeyConnectorConversion: null,
      });
    });
  });

  describe("rollback", () => {
    it("is irreversible", async () => {
      await expect(runMigrator(sut, {}, "rollback")).rejects.toThrow(IRREVERSIBLE);
    });
  });
});
