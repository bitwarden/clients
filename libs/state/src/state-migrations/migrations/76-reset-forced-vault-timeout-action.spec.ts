import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { ResetForcedVaultTimeoutAction } from "./76-reset-forced-vault-timeout-action";

describe("ResetForcedVaultTimeoutAction", () => {
  const sut = new ResetForcedVaultTimeoutAction(75, 76);

  describe("migrate", () => {
    it("resets stored logOut to null for TDE user (hasMasterPassword = false)", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: { email: "user1@example.com", name: "User 1", emailVerified: true },
        },
        user_user1_vaultTimeoutSettings_vaultTimeoutAction: "logOut",
        user_user1_userDecryptionOptions_decryptionOptions: { hasMasterPassword: false },
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: { email: "user1@example.com", name: "User 1", emailVerified: true },
        },
        user_user1_vaultTimeoutSettings_vaultTimeoutAction: null,
        user_user1_userDecryptionOptions_decryptionOptions: { hasMasterPassword: false },
      });
    });

    it("leaves stored lock unchanged for TDE user", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: { email: "user1@example.com", name: "User 1", emailVerified: true },
        },
        user_user1_vaultTimeoutSettings_vaultTimeoutAction: "lock",
        user_user1_userDecryptionOptions_decryptionOptions: { hasMasterPassword: false },
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: { email: "user1@example.com", name: "User 1", emailVerified: true },
        },
        user_user1_vaultTimeoutSettings_vaultTimeoutAction: "lock",
        user_user1_userDecryptionOptions_decryptionOptions: { hasMasterPassword: false },
      });
    });

    it("leaves stored null unchanged for TDE user", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: { email: "user1@example.com", name: "User 1", emailVerified: true },
        },
        user_user1_vaultTimeoutSettings_vaultTimeoutAction: null,
        user_user1_userDecryptionOptions_decryptionOptions: { hasMasterPassword: false },
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: { email: "user1@example.com", name: "User 1", emailVerified: true },
        },
        user_user1_vaultTimeoutSettings_vaultTimeoutAction: null,
        user_user1_userDecryptionOptions_decryptionOptions: { hasMasterPassword: false },
      });
    });

    it("does not reset stored logOut for non-TDE user (hasMasterPassword = true)", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: { email: "user1@example.com", name: "User 1", emailVerified: true },
        },
        user_user1_vaultTimeoutSettings_vaultTimeoutAction: "logOut",
        user_user1_userDecryptionOptions_decryptionOptions: { hasMasterPassword: true },
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: { email: "user1@example.com", name: "User 1", emailVerified: true },
        },
        user_user1_vaultTimeoutSettings_vaultTimeoutAction: "logOut",
        user_user1_userDecryptionOptions_decryptionOptions: { hasMasterPassword: true },
      });
    });

    it("does not reset stored logOut when decryptionOptions is null", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: { email: "user1@example.com", name: "User 1", emailVerified: true },
        },
        user_user1_vaultTimeoutSettings_vaultTimeoutAction: "logOut",
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: { email: "user1@example.com", name: "User 1", emailVerified: true },
        },
        user_user1_vaultTimeoutSettings_vaultTimeoutAction: "logOut",
      });
    });
  });

  describe("rollback", () => {
    it("is irreversible", async () => {
      await expect(runMigrator(sut, {}, "rollback")).rejects.toThrow(IRREVERSIBLE);
    });
  });
});
