import { runMigrator } from "../migration-helper.spec";

import { AddMasterPasswordUnlockData } from "./73-add-master-password-unlock-data";

describe("AddMasterPasswordUnlockData", () => {
  const sut = new AddMasterPasswordUnlockData(72, 73);

  describe("migrate", () => {
    it("updates users that don't have master password unlock data", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: {
            email: "user1@email.Com",
            name: "User 1",
          },
          user2: {
            email: "user2@email.com",
            name: "User 2",
          },
        },
        user_user1_masterPassword_masterKeyEncryptedUserKey: "user1MasterKeyEncryptedUser",
        user_user1_kdfConfig_kdfConfig: { kdfType: 0, iterations: 600000 },
        user_user2_masterPassword_masterKeyEncryptedUserKey: "user2MasterKeyEncryptedUser",
        user_user2_kdfConfig_kdfConfig: { kdfType: 0, iterations: 600001 },
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: {
            email: "user1@email.Com",
            name: "User 1",
          },
          user2: {
            email: "user2@email.com",
            name: "User 2",
          },
        },
        user_user1_masterPassword_masterKeyEncryptedUserKey: "user1MasterKeyEncryptedUser",
        user_user1_kdfConfig_kdfConfig: { kdfType: 0, iterations: 600000 },
        user_user1_masterPasswordUnlock_masterPasswordUnlockKey: {
          salt: "user1@email.com",
          kdf: { kdfType: 0, iterations: 600000 },
          masterKeyWrappedUserKey: "user1MasterKeyEncryptedUser",
        },
        user_user2_masterPassword_masterKeyEncryptedUserKey: "user2MasterKeyEncryptedUser",
        user_user2_kdfConfig_kdfConfig: { kdfType: 0, iterations: 600001 },
        user_user2_masterPasswordUnlock_masterPasswordUnlockKey: {
          salt: "user2@email.com",
          kdf: { kdfType: 0, iterations: 600001 },
          masterKeyWrappedUserKey: "user2MasterKeyEncryptedUser",
        },
      });
    });

    it("does not update users that already have master password unlock data", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: {
            email: "user1@email.Com",
            name: "User 1",
          },
        },
        user_user1_masterPassword_masterKeyEncryptedUserKey: "user1MasterKeyEncryptedUser",
        user_user1_kdfConfig_kdfConfig: { kdfType: 0, iterations: 600000 },
        user_user1_masterPasswordUnlock_masterPasswordUnlockKey: { someData: "data" },
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: {
            email: "user1@email.Com",
            name: "User 1",
          },
        },
        user_user1_masterPassword_masterKeyEncryptedUserKey: "user1MasterKeyEncryptedUser",
        user_user1_kdfConfig_kdfConfig: { kdfType: 0, iterations: 600000 },
        user_user1_masterPasswordUnlock_masterPasswordUnlockKey: { someData: "data" },
      });
    });

    it("does not update users that have missing data required to construct master password unlock data", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: {
            name: "User 1",
          },
        },
        user_user1_kdfConfig_kdfConfig: { kdfType: 0, iterations: 600000 },
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: {
            name: "User 1",
          },
        },
        user_user1_kdfConfig_kdfConfig: { kdfType: 0, iterations: 600000 },
      });
    });
  });

  describe("rollback", () => {
    it("rolls back data", async () => {
      const output = await runMigrator(
        sut,
        {
          global_account_accounts: {
            user1: {
              email: "user1@email.Com",
              name: "User 1",
            },
            user2: {
              email: "user2@email.com",
              name: "User 2",
            },
            user3: {
              email: "user3@email.com",
              name: "User 3",
            },
          },
          user_user1_masterPassword_masterKeyEncryptedUserKey: "user1MasterKeyEncryptedUser",
          user_user1_kdfConfig_kdfConfig: { kdfType: 0, iterations: 600000 },
          user_user2_masterPassword_masterKeyEncryptedUserKey: "user2MasterKeyEncryptedUser",
          user_user2_kdfConfig_kdfConfig: { kdfType: 0, iterations: 600001 },
          user_user1_masterPasswordUnlock_masterPasswordUnlockKey: "fakeData",
          user_user2_masterPasswordUnlock_masterPasswordUnlockKey: "fakeData",
          user_user3_masterPasswordUnlock_masterPasswordUnlockKey: null,
        },
        "rollback",
      );

      expect(output).toEqual({
        global_account_accounts: {
          user1: {
            email: "user1@email.Com",
            name: "User 1",
          },
          user2: {
            email: "user2@email.com",
            name: "User 2",
          },
          user3: {
            email: "user3@email.com",
            name: "User 3",
          },
        },
        user_user1_masterPassword_masterKeyEncryptedUserKey: "user1MasterKeyEncryptedUser",
        user_user1_kdfConfig_kdfConfig: { kdfType: 0, iterations: 600000 },
        user_user2_masterPassword_masterKeyEncryptedUserKey: "user2MasterKeyEncryptedUser",
        user_user2_kdfConfig_kdfConfig: { kdfType: 0, iterations: 600001 },
        user_user3_masterPasswordUnlock_masterPasswordUnlockKey: null,
      });
    });
  });
});
