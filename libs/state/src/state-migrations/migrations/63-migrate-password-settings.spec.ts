import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import {
  ExpectedOptions,
  PasswordOptionsMigrator,
  NAVIGATION,
  PASSWORD,
  PASSPHRASE,
} from "./63-migrate-password-settings";

function migrationHelper(passwordGenerationOptions: ExpectedOptions) {
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
          passwordGenerationOptions,
          this: {
            looks: "important",
          },
        },
        cant: {
          touch: "this",
        },
      },
    },
    62,
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

describe("PasswordOptionsMigrator", () => {
  describe("migrate", () => {
    it("migrates generator type", async () => {
      const helper = migrationHelper({
        type: "password",
      });
      helper.getFromUser.mockResolvedValue({ some: { other: "data" } });
      const migrator = new PasswordOptionsMigrator(62, 63);

      await migrator.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("SomeAccount", NAVIGATION, {
        type: "password",
        some: { other: "data" },
      });
      expectOtherSettingsRemain(helper);
    });

    it("migrates password settings", async () => {
      const helper = migrationHelper({
        length: 20,
        ambiguous: true,
        uppercase: false,
        minUppercase: 4,
        lowercase: true,
        minLowercase: 3,
        number: false,
        minNumber: 2,
        special: true,
        minSpecial: 1,
      });
      const migrator = new PasswordOptionsMigrator(62, 63);

      await migrator.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("SomeAccount", PASSWORD, {
        length: 20,
        ambiguous: true,
        uppercase: false,
        minUppercase: 4,
        lowercase: true,
        minLowercase: 3,
        number: false,
        minNumber: 2,
        special: true,
        minSpecial: 1,
      });
      expectOtherSettingsRemain(helper);
    });

    it("migrates passphrase settings", async () => {
      const helper = migrationHelper({
        numWords: 5,
        wordSeparator: "4",
        capitalize: true,
        includeNumber: false,
      });
      const migrator = new PasswordOptionsMigrator(62, 63);

      await migrator.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith("SomeAccount", PASSPHRASE, {
        numWords: 5,
        wordSeparator: "4",
        capitalize: true,
        includeNumber: false,
      });
      expectOtherSettingsRemain(helper);
    });
  });
});
