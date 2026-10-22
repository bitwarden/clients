import { runMigrator } from "../migration-helper.spec";

import { MoveWebAuthnPrfOptionsToCryptoState } from "./83-move-webauthn-prf-options-to-crypto-state";

const prfOption = (credentialId: string) => ({
  encryptedPrivateKey: `${credentialId}-encryptedPrivateKey`,
  encryptedUserKey: `${credentialId}-encryptedUserKey`,
  credentialId,
  transports: ["internal"],
});

describe("MoveWebAuthnPrfOptionsToCryptoState", () => {
  const sut = new MoveWebAuthnPrfOptionsToCryptoState(82, 83);

  describe("migrate", () => {
    it("copies webAuthnPrfOptions into the new state, leaving the source intact", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: { email: "user1@email.com", name: "User 1" },
          user2: { email: "user2@email.com", name: "User 2" },
        },
        user_user1_userDecryptionOptions_decryptionOptions: {
          hasMasterPassword: true,
          webAuthnPrfOptions: [prfOption("credential1"), prfOption("credential2")],
        },
        user_user2_userDecryptionOptions_decryptionOptions: {
          hasMasterPassword: false,
          webAuthnPrfOptions: [prfOption("credential3")],
        },
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: { email: "user1@email.com", name: "User 1" },
          user2: { email: "user2@email.com", name: "User 2" },
        },
        user_user1_userDecryptionOptions_decryptionOptions: {
          hasMasterPassword: true,
          webAuthnPrfOptions: [prfOption("credential1"), prfOption("credential2")],
        },
        user_user1_crypto_webAuthnPrfOptions: {
          options: [prfOption("credential1"), prfOption("credential2")],
        },
        user_user2_userDecryptionOptions_decryptionOptions: {
          hasMasterPassword: false,
          webAuthnPrfOptions: [prfOption("credential3")],
        },
        user_user2_crypto_webAuthnPrfOptions: {
          options: [prfOption("credential3")],
        },
      });
    });

    it("does not write for users without webAuthnPrfOptions", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: { email: "user1@email.com", name: "User 1" },
          user2: { email: "user2@email.com", name: "User 2" },
        },
        user_user1_userDecryptionOptions_decryptionOptions: { hasMasterPassword: true },
        user_user2_userDecryptionOptions_decryptionOptions: {
          hasMasterPassword: true,
          webAuthnPrfOptions: [],
        },
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: { email: "user1@email.com", name: "User 1" },
          user2: { email: "user2@email.com", name: "User 2" },
        },
        user_user1_userDecryptionOptions_decryptionOptions: { hasMasterPassword: true },
        user_user2_userDecryptionOptions_decryptionOptions: {
          hasMasterPassword: true,
          webAuthnPrfOptions: [],
        },
      });
    });

    it("does not write for users that have no decryption options at all", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: { email: "user1@email.com", name: "User 1" },
        },
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: { email: "user1@email.com", name: "User 1" },
        },
      });
    });

    it("does not overwrite an existing new state", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: { email: "user1@email.com", name: "User 1" },
        },
        user_user1_userDecryptionOptions_decryptionOptions: {
          webAuthnPrfOptions: [prfOption("credential1")],
        },
        user_user1_crypto_webAuthnPrfOptions: { options: [prfOption("alreadyMigrated")] },
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: { email: "user1@email.com", name: "User 1" },
        },
        user_user1_userDecryptionOptions_decryptionOptions: {
          webAuthnPrfOptions: [prfOption("credential1")],
        },
        user_user1_crypto_webAuthnPrfOptions: { options: [prfOption("alreadyMigrated")] },
      });
    });
  });

  describe("rollback", () => {
    it("removes the new state, leaving the source intact", async () => {
      const output = await runMigrator(
        sut,
        {
          global_account_accounts: {
            user1: { email: "user1@email.com", name: "User 1" },
            user2: { email: "user2@email.com", name: "User 2" },
          },
          user_user1_userDecryptionOptions_decryptionOptions: {
            webAuthnPrfOptions: [prfOption("credential1")],
          },
          // A plain string rather than the real shape: runMigrator injects sentinel properties into
          // every nested object and asserts they all survive, which a removal would defeat.
          user_user1_crypto_webAuthnPrfOptions: "fakeData",
          user_user2_crypto_webAuthnPrfOptions: null,
        },
        "rollback",
      );

      expect(output).toEqual({
        global_account_accounts: {
          user1: { email: "user1@email.com", name: "User 1" },
          user2: { email: "user2@email.com", name: "User 2" },
        },
        user_user1_userDecryptionOptions_decryptionOptions: {
          webAuthnPrfOptions: [prfOption("credential1")],
        },
        user_user2_crypto_webAuthnPrfOptions: null,
      });
    });
  });
});
