import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { RemoveBiometricClientKeyHalf } from "./85-remove-biometric-client-key-half";

describe("RemoveBiometricClientKeyHalf", () => {
  const sut = new RemoveBiometricClientKeyHalf(84, 85);

  const accounts = {
    user1: { email: "user1@email.com", name: "User 1", emailVerified: true },
    user2: { email: "user2@email.com", name: "User 2", emailVerified: true },
  };

  describe("migrate", () => {
    it("removes the client key half from all users and the fingerprint validated flag", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: accounts,
        user_user1_biometricSettings_clientKeyHalf: "2.encrypted|data|mac",
        user_user2_biometricSettings_clientKeyHalf: "2.encrypted|data|mac",
        global_biometricSettings_fingerprintValidated: true,
      });

      expect(output).toEqual({ global_account_accounts: accounts });
    });

    it("leaves unrelated state untouched", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: accounts,
        user_user1_biometricSettings_biometricUnlockEnabled: true,
      });

      expect(output).toEqual({
        global_account_accounts: accounts,
        user_user1_biometricSettings_biometricUnlockEnabled: true,
      });
    });
  });

  describe("rollback", () => {
    it("is irreversible", async () => {
      await expect(runMigrator(sut, {}, "rollback")).rejects.toThrow(IRREVERSIBLE);
    });
  });
});
