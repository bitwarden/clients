import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { RemoveLegacyPin } from "./74-remove-legacy-pin";

describe("RemoveLegacyPin", () => {
  const sut = new RemoveLegacyPin(73, 74);

  describe("migrate", () => {
    it("deletes legacy pin from all users", async () => {
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
        user_user1_pinUnlock_pinKeyEncryptedUserKeyPersistent: "abc",
        user_user2_pinUnlock_pinKeyEncryptedUserKeyPersistent: "def",
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
