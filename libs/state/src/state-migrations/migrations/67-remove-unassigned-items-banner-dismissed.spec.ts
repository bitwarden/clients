import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { RemoveUnassignedItemsBannerDismissed } from "./67-remove-unassigned-items-banner-dismissed";

describe("RemoveUnassignedItemsBannerDismissed", () => {
  const sut = new RemoveUnassignedItemsBannerDismissed(66, 67);

  describe("migrate", () => {
    it("deletes unassignedItemsBanner from all users", async () => {
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
        user_user1_unassignedItemsBanner_showBanner: true,
        user_user2_unassignedItemsBanner_showBanner: false,
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
