import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { RemoveMasterKeyEncryptedUserKey } from "./86-remove-master-key-encrypted-user-key";

describe("RemoveMasterKeyEncryptedUserKey", () => {
  const sut = new RemoveMasterKeyEncryptedUserKey(85, 86);

  const accounts = {
    user1: { email: "user1@email.com", name: "User 1", emailVerified: true },
    user2: { email: "user2@email.com", name: "User 2", emailVerified: true },
  };

  describe("migrate", () => {
    it("removes the master key encrypted user key from all users", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: accounts,
        user_user1_masterPassword_masterKeyEncryptedUserKey: "2.encrypted|data|mac",
        user_user2_masterPassword_masterKeyEncryptedUserKey: "2.encrypted|data|mac",
      });

      expect(output).toEqual({ global_account_accounts: accounts });
    });

    it("leaves unrelated state untouched", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: accounts,
        user_user1_masterPasswordUnlock_masterPasswordUnlockKey: {
          salt: "user1@email.com",
          kdf: { iterations: 600000 },
          masterKeyWrappedUserKey: "2.encrypted|data|mac",
        },
      });

      expect(output).toEqual({
        global_account_accounts: accounts,
        user_user1_masterPasswordUnlock_masterPasswordUnlockKey: {
          salt: "user1@email.com",
          kdf: { iterations: 600000 },
          masterKeyWrappedUserKey: "2.encrypted|data|mac",
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
