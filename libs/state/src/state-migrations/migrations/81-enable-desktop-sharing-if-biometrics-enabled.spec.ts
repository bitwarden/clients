import { runMigrator } from "../migration-helper.spec";

import { EnableDesktopSharingIfBiometricsEnabled } from "./81-enable-desktop-sharing-if-biometrics-enabled";

describe("EnableDesktopSharingIfBiometricsEnabled", () => {
  const sut = new EnableDesktopSharingIfBiometricsEnabled(80, 81);

  describe("migrate", () => {
    it("enables desktop sharing for users with biometric unlock enabled", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: {
          user1: {},
          user2: {},
          user3: {},
        },
        user_user1_biometricSettings_biometricUnlockEnabled: true,
        user_user2_biometricSettings_biometricUnlockEnabled: false,
        // user3 has no biometric setting
      });

      expect(output).toEqual({
        global_account_accounts: {
          user1: {},
          user2: {},
          user3: {},
        },
        user_user1_biometricSettings_biometricUnlockEnabled: true,
        user_user1_sharedUnlockSettings_allowSharingUnlockStateWithDesktop: true,
        user_user2_biometricSettings_biometricUnlockEnabled: false,
      });
    });

    it("does not overwrite desktop sharing when it is already set", async () => {
      const output = await runMigrator(sut, {
        global_account_accounts: { user1: {} },
        user_user1_biometricSettings_biometricUnlockEnabled: true,
        user_user1_sharedUnlockSettings_allowSharingUnlockStateWithDesktop: false,
      });

      expect(output).toEqual({
        global_account_accounts: { user1: {} },
        user_user1_biometricSettings_biometricUnlockEnabled: true,
        user_user1_sharedUnlockSettings_allowSharingUnlockStateWithDesktop: false,
      });
    });

    it("does nothing when there are no accounts", async () => {
      const output = await runMigrator(sut, {});

      expect(output).toEqual({});
    });
  });

  describe("rollback", () => {
    it("removes desktop sharing for users with biometric unlock enabled", async () => {
      const output = await runMigrator(
        sut,
        {
          global_account_accounts: {
            user1: {},
            user2: {},
          },
          user_user1_biometricSettings_biometricUnlockEnabled: true,
          user_user1_sharedUnlockSettings_allowSharingUnlockStateWithDesktop: true,
          user_user2_biometricSettings_biometricUnlockEnabled: false,
          user_user2_sharedUnlockSettings_allowSharingUnlockStateWithDesktop: true,
        },
        "rollback",
      );

      expect(output).toEqual({
        global_account_accounts: {
          user1: {},
          user2: {},
        },
        user_user1_biometricSettings_biometricUnlockEnabled: true,
        user_user2_biometricSettings_biometricUnlockEnabled: false,
        user_user2_sharedUnlockSettings_allowSharingUnlockStateWithDesktop: true,
      });
    });
  });
});
