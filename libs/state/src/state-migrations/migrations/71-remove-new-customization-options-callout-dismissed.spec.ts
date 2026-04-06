import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { RemoveNewCustomizationOptionsCalloutDismissed } from "./71-remove-new-customization-options-callout-dismissed";

describe("RemoveNewCustomizationOptionsCalloutDismissed", () => {
  const sut = new RemoveNewCustomizationOptionsCalloutDismissed(70, 71);

  describe("migrate", () => {
    it("deletes new customization options callout dismissed from all users", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: {
            email: "user1@email.com",
            name: "User 1",
            emailVerified: true,
          },
          user2: {
            email: "user2@email.com",
            name: "User 2",
            emailVerified: true,
          },
        },
        user_user1_bannersDismissed_newCustomizationOptionsCalloutDismissed: true,
        user_user2_bannersDismissed_newCustomizationOptionsCalloutDismissed: true,
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: {
            email: "user1@email.com",
            name: "User 1",
            emailVerified: true,
          },
          user2: {
            email: "user2@email.com",
            name: "User 2",
            emailVerified: true,
          },
        },
      });
    });
  });

  describe("rollback", () => {
    it("is irreversible", async () => {
      await expect(runMigrator(sut, {}, "rollback")).rejects.toThrow(IRREVERSIBLE);
    });
  });
});
