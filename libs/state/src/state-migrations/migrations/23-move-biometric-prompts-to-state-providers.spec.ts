import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import {
  MoveBiometricPromptsToStateProviders,
  DISMISSED_BIOMETRIC_REQUIRE_PASSWORD_ON_START_CALLOUT,
  PROMPT_AUTOMATICALLY,
} from "./23-move-biometric-prompts-to-state-providers";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
    "user-1": {
      settings: {
        disableAutoBiometricsPrompt: false,
        dismissedBiometricRequirePasswordOnStartCallout: true,
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      otherStuff: "otherStuff4",
    },
  };
}

function rollbackJSON() {
  return {
    "user_user-1_biometricSettings_dismissedBiometricRequirePasswordOnStartCallout": true,
    "user_user-1_biometricSettings_promptAutomatically": "false",
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
    "user-1": {
      settings: {
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      otherStuff: "otherStuff4",
    },
  };
}

describe("MoveBiometricPromptsToStateProviders migrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: MoveBiometricPromptsToStateProviders;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 22);
      sut = new MoveBiometricPromptsToStateProviders(22, 23);
    });

    it("should remove biometricUnlock, dismissedBiometricRequirePasswordOnStartCallout, and biometricEncryptionClientKeyHalf from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledTimes(2);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.set).toHaveBeenCalledWith("user-2", {
        otherStuff: "otherStuff4",
      });
    });

    it("should set dismissedBiometricRequirePasswordOnStartCallout value for account that have it", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        DISMISSED_BIOMETRIC_REQUIRE_PASSWORD_ON_START_CALLOUT,
        true,
      );
    });

    it("should not call extra setToUser", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(2);
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 23);
      sut = new MoveBiometricPromptsToStateProviders(22, 23);
    });

    it.each([DISMISSED_BIOMETRIC_REQUIRE_PASSWORD_ON_START_CALLOUT, PROMPT_AUTOMATICALLY])(
      "should null out new values %s",
      async (keyDefinition) => {
        await sut.rollback(helper);

        expect(helper.setToUser).toHaveBeenCalledWith("user-1", keyDefinition, null);
      },
    );

    it("should add explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          disableAutoBiometricsPrompt: false,
          dismissedBiometricRequirePasswordOnStartCallout: true,
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it.each(["user-2", "user-3"])(
      "should not try to restore values to missing accounts",
      async (userId) => {
        await sut.rollback(helper);

        expect(helper.set).not.toHaveBeenCalledWith(userId, any());
      },
    );
  });
});
