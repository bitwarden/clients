import { mockMigrationHelper, runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { KDF_CONFIG, RemoveKdfConfig } from "./88-remove-kdf-config";

describe("RemoveKdfConfig", () => {
  const sut = new RemoveKdfConfig(87, 88);

  const accounts = {
    user1: { email: "user1@email.com", name: "User 1", emailVerified: true },
    user2: { email: "user2@email.com", name: "User 2", emailVerified: true },
  };

  describe("migrate", () => {
    // runMigrator can't be used when an object value is removed, because it expects the data it
    // injects into that object to survive the migration.
    it("removes the KDF config from all users", async () => {
      const helper = mockMigrationHelper(
        {
          global_account_accounts: accounts,
          user_user1_kdfConfig_kdfConfig: { kdfType: 0, iterations: 600000 },
          user_user2_kdfConfig_kdfConfig: { kdfType: 1, iterations: 3, memory: 64, parallelism: 4 },
        },
        87,
      );

      await sut.migrate(helper);

      expect(await helper.getFromUser("user1", KDF_CONFIG)).toBeUndefined();
      expect(await helper.getFromUser("user2", KDF_CONFIG)).toBeUndefined();
    });

    it("leaves unrelated state untouched", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: accounts,
        user_user1_masterPasswordUnlock_masterPasswordUnlockKey: {
          salt: "user1@email.com",
          kdf: { kdfType: 0, iterations: 600000 },
          masterKeyWrappedUserKey: "2.encrypted|data|mac",
        },
      });

      expect(output).toEqual({
        global_account_accounts: accounts,
        user_user1_masterPasswordUnlock_masterPasswordUnlockKey: {
          salt: "user1@email.com",
          kdf: { kdfType: 0, iterations: 600000 },
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
