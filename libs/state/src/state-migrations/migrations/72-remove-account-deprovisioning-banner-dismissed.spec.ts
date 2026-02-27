import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { RemoveAccountDeprovisioningBannerDismissed } from "./72-remove-account-deprovisioning-banner-dismissed";

describe("RemoveAcBannersDismissed", () => {
  const sut = new RemoveAccountDeprovisioningBannerDismissed(71, 72);

  describe("migrate", () => {
    it("deletes account deprovisioning banner from all users", async () => {
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
        user_user1_accountDeprovisioningBanner_showAccountDeprovisioningBanner: true,
        user_user2_accountDeprovisioningBanner_showAccountDeprovisioningBanner: true,
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
