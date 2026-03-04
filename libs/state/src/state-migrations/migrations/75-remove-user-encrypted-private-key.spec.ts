import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { RemoveUserEncryptedPrivateKey } from "./75-remove-user-encrypted-private-key";

describe("RemoveUserEncryptedPrivateKey", () => {
  const sut = new RemoveUserEncryptedPrivateKey(74, 75);

  describe("migrate", () => {
    it("migrates V1 cryptographic state (privateKey only)", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: {
            email: "user1@email.com",
            name: "User 1",
            emailVerified: true,
          },
        },
        user_user1_crypto_privateKey: "encryptedPrivateKey",
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: {
            email: "user1@email.com",
            name: "User 1",
            emailVerified: true,
          },
        },
        user_user1_crypto_accountCryptographicState: {
          V1: {
            private_key: "encryptedPrivateKey",
          },
        },
      });
    });

    it("migrates V2 cryptographic state (all keys present)", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: {
            email: "user1@email.com",
            name: "User 1",
            emailVerified: true,
          },
        },
        user_user1_crypto_privateKey: "encryptedPrivateKey",
        user_user1_crypto_userSigningKey: "signingKey",
        user_user1_crypto_userSignedPublicKey: "signedPublicKey",
        user_user1_crypto_accountSecurityState: "securityState",
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: {
            email: "user1@email.com",
            name: "User 1",
            emailVerified: true,
          },
        },
        user_user1_crypto_accountCryptographicState: {
          V2: {
            private_key: "encryptedPrivateKey",
            signing_key: "signingKey",
            signed_public_key: "signedPublicKey",
            security_state: "securityState",
          },
        },
      });
    });

    it("migrates multiple users with different cryptographic states", async () => {
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
          user3: {
            email: "user3@email.com",
            name: "User 3",
            emailVerified: true,
          },
        },
        // user1: V1 state
        user_user1_crypto_privateKey: "privateKey1",
        // user2: V2 state
        user_user2_crypto_privateKey: "privateKey2",
        user_user2_crypto_userSigningKey: "signingKey2",
        user_user2_crypto_userSignedPublicKey: "signedPublicKey2",
        user_user2_crypto_accountSecurityState: "securityState2",
        // user3: no cryptographic state
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
          user3: {
            email: "user3@email.com",
            name: "User 3",
            emailVerified: true,
          },
        },
        user_user1_crypto_accountCryptographicState: {
          V1: {
            private_key: "privateKey1",
          },
        },
        user_user2_crypto_accountCryptographicState: {
          V2: {
            private_key: "privateKey2",
            signing_key: "signingKey2",
            signed_public_key: "signedPublicKey2",
            security_state: "securityState2",
          },
        },
      });
    });

    it("does not overwrite existing accountCryptographicState", async () => {
      const existingState = {
        V1: {
          private_key: "existingPrivateKey",
        },
      };

      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: {
            email: "user1@email.com",
            name: "User 1",
            emailVerified: true,
          },
        },
        user_user1_crypto_accountCryptographicState: existingState,
        user_user1_crypto_privateKey: "newPrivateKey",
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: {
            email: "user1@email.com",
            name: "User 1",
            emailVerified: true,
          },
        },
        user_user1_crypto_accountCryptographicState: existingState,
      });
    });
  });

  describe("rollback", () => {
    it("is irreversible", async () => {
      await expect(runMigrator(sut, {}, "rollback")).rejects.toThrow(IRREVERSIBLE);
    });
  });
});
