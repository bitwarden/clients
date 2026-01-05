import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import {
  ADDY_IO,
  CATCHALL,
  DUCK_DUCK_GO,
  EFF_USERNAME,
  ExpectedOptions,
  FASTMAIL,
  FIREFOX_RELAY,
  FORWARD_EMAIL,
  ForwarderOptionsMigrator,
  NAVIGATION,
  SIMPLE_LOGIN,
  SUBADDRESS,
} from "./65-migrate-forwarder-settings";

function migrationHelper(usernameGenerationOptions: ExpectedOptions) {
  const helper = mockMigrationHelper(
    {
      global_account_accounts: {
        SomeAccount: {
          email: "SomeAccount",
          name: "SomeAccount",
          emailVerified: true,
        },
      },
      SomeAccount: {
        settings: {
          usernameGenerationOptions,
          this: {
            looks: "important",
          },
        },
        cant: {
          touch: "this",
        },
      },
    },
    64,
  );

  return helper;
}

function expectOtherSettingsRemain(helper: MigrationHelper) {
  expect(helper.set).toHaveBeenCalledWith("SomeAccount", {
    settings: {
      this: {
        looks: "important",
      },
    },
    cant: {
      touch: "this",
    },
  });
}

describe("ForwarderOptionsMigrator", () => {
  describe("migrate", () => {
    it("migrates generator settings", async () => {
      const helper = migrationHelper({
        type: "catchall",
        forwardedService: "simplelogin",
      });
      const migrator = new ForwarderOptionsMigrator(64, 65);

      await migrator.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("SomeAccount", NAVIGATION, {
        username: "catchall",
        forwarder: "simplelogin",
      });
      expectOtherSettingsRemain(helper);
    });

    it("migrates catchall settings", async () => {
      const helper = migrationHelper({
        catchallType: "random",
        catchallDomain: "example.com",
      });
      const migrator = new ForwarderOptionsMigrator(64, 65);

      await migrator.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("SomeAccount", CATCHALL, {
        catchallType: "random",
        catchallDomain: "example.com",
      });
      expectOtherSettingsRemain(helper);
    });

    it("migrates EFF username settings", async () => {
      const helper = migrationHelper({
        wordCapitalize: true,
        wordIncludeNumber: false,
      });
      const migrator = new ForwarderOptionsMigrator(64, 65);

      await migrator.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("SomeAccount", EFF_USERNAME, {
        wordCapitalize: true,
        wordIncludeNumber: false,
      });
      expectOtherSettingsRemain(helper);
    });

    it("migrates subaddress settings", async () => {
      const helper = migrationHelper({
        subaddressType: "random",
        subaddressEmail: "j.d@example.com",
      });
      const migrator = new ForwarderOptionsMigrator(64, 65);

      await migrator.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("SomeAccount", SUBADDRESS, {
        subaddressType: "random",
        subaddressEmail: "j.d@example.com",
      });
      expectOtherSettingsRemain(helper);
    });

    it("migrates addyIo settings", async () => {
      const helper = migrationHelper({
        forwardedAnonAddyBaseUrl: "some_addyio_base",
        forwardedAnonAddyApiToken: "some_addyio_token",
        forwardedAnonAddyDomain: "some_addyio_domain",
      });
      const migrator = new ForwarderOptionsMigrator(64, 65);

      await migrator.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("SomeAccount", ADDY_IO, {
        baseUrl: "some_addyio_base",
        token: "some_addyio_token",
        domain: "some_addyio_domain",
      });
      expectOtherSettingsRemain(helper);
    });

    it("migrates DuckDuckGo settings", async () => {
      const helper = migrationHelper({
        forwardedDuckDuckGoToken: "some_duckduckgo_token",
      });
      const migrator = new ForwarderOptionsMigrator(64, 65);

      await migrator.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("SomeAccount", DUCK_DUCK_GO, {
        token: "some_duckduckgo_token",
      });
      expectOtherSettingsRemain(helper);
    });

    it("migrates Firefox Relay settings", async () => {
      const helper = migrationHelper({
        forwardedFirefoxApiToken: "some_firefox_token",
      });
      const migrator = new ForwarderOptionsMigrator(64, 65);

      await migrator.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("SomeAccount", FIREFOX_RELAY, {
        token: "some_firefox_token",
      });
      expectOtherSettingsRemain(helper);
    });

    it("migrates Fastmail settings", async () => {
      const helper = migrationHelper({
        forwardedFastmailApiToken: "some_fastmail_token",
      });
      const migrator = new ForwarderOptionsMigrator(64, 65);

      await migrator.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("SomeAccount", FASTMAIL, {
        token: "some_fastmail_token",
      });
      expectOtherSettingsRemain(helper);
    });

    it("migrates ForwardEmail settings", async () => {
      const helper = migrationHelper({
        forwardedForwardEmailApiToken: "some_forwardemail_token",
        forwardedForwardEmailDomain: "some_forwardemail_domain",
      });
      const migrator = new ForwarderOptionsMigrator(64, 65);

      await migrator.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("SomeAccount", FORWARD_EMAIL, {
        token: "some_forwardemail_token",
        domain: "some_forwardemail_domain",
      });
      expectOtherSettingsRemain(helper);
    });

    it("migrates SimpleLogin settings", async () => {
      const helper = migrationHelper({
        forwardedSimpleLoginApiKey: "some_simplelogin_token",
        forwardedSimpleLoginBaseUrl: "some_simplelogin_baseurl",
      });
      const migrator = new ForwarderOptionsMigrator(64, 65);

      await migrator.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("SomeAccount", SIMPLE_LOGIN, {
        token: "some_simplelogin_token",
        baseUrl: "some_simplelogin_baseurl",
      });
      expectOtherSettingsRemain(helper);
    });
  });
});
