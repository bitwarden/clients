import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { RemoveUserEncryptedPrivateKey } from "./75-remove-user-encrypted-private-key";

describe("RemoveUserEncryptedPrivateKey", () => {
  const sut = new RemoveUserEncryptedPrivateKey(74, 75);

  describe("migrate", () => {
    it("deletes user encrypted private key, signing key, and signed public key from all users", async () => {
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
        user_user1_CRYPTO_DISK_privateKey: "abc",
        user_user2_CRYPTO_DISK_privateKey: "def",
        user_user1_CRYPTO_DISK_userSigningKey: "sign1",
        user_user2_CRYPTO_DISK_userSigningKey: "sign2",
        user_user1_CRYPTO_DISK_userSignedPublicKey: "pub1",
        user_user2_CRYPTO_DISK_userSignedPublicKey: "pub2",
        user_user1_CRYPTO_DISK_accountSecurityState: "security1",
        user_user2_CRYPTO_DISK_accountSecurityState: "security2",
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
