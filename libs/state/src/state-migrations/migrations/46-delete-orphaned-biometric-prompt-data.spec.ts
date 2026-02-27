import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { DeleteBiometricPromptCancelledData } from "./46-delete-orphaned-biometric-prompt-data";

describe("MoveThemeToStateProviders", () => {
  const sut = new DeleteBiometricPromptCancelledData(45, 46);

  describe("migrate", () => {
    it("deletes promptCancelled from all users", async () => {
      const output = await runMigrator(sut, {
        authenticatedAccounts: ["user-1", "user-2"],
        "user_user-1_biometricSettings_promptCancelled": true,
        "user_user-2_biometricSettings_promptCancelled": false,
      });

      expect(output).toEqual({
        authenticatedAccounts: ["user-1", "user-2"],
      });
    });
  });

  describe("rollback", () => {
    it("is irreversible", async () => {
      await expect(runMigrator(sut, {}, "rollback")).rejects.toThrow(IRREVERSIBLE);
    });
  });
});
