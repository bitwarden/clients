import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { RemoveAcBannersDismissed } from "./70-remove-ac-banner-dismissed";

describe("RemoveAcBannersDismissed", () => {
  const sut = new RemoveAcBannersDismissed(69, 70);

  describe("migrate", () => {
    it("deletes ac banner from all users", async () => {
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
        user_user1_showProviderClientVaultPrivacyBanner_acBannersDismissed: true,
        user_user2_showProviderClientVaultPrivacyBanner_acBannersDismissed: true,
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
