import { MockProxy, any, matches } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { MoveBiometricAutoPromptToAccount } from "./7-move-biometric-auto-prompt-to-account";

function exampleJSON() {
  return {
    global: {
      stateVersion: 6,
      noAutoPromptBiometrics: true,
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: [
      "c493ed01-4e08-4e88-abc7-332f380ca760",
      "23e61a5f-2ece-4f5e-b499-f0bc489482a9",
      "fd005ea6-a16a-45ef-ba4a-a194269bfd73",
    ],
    "c493ed01-4e08-4e88-abc7-332f380ca760": {
      settings: {
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "23e61a5f-2ece-4f5e-b499-f0bc489482a9": {
      settings: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

describe("RemoveLegacyEtmKeyMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: MoveBiometricAutoPromptToAccount;

  beforeEach(() => {
    helper = mockMigrationHelper(exampleJSON());
    sut = new MoveBiometricAutoPromptToAccount(6, 7);
  });

  describe("migrate", () => {
    it("should remove noAutoPromptBiometrics from global", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("global", {
        otherStuff: "otherStuff1",
        stateVersion: 6,
      });
    });

    it("should set disableAutoBiometricsPrompt to true on all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("c493ed01-4e08-4e88-abc7-332f380ca760", {
        settings: {
          disableAutoBiometricsPrompt: true,
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.set).toHaveBeenCalledWith("23e61a5f-2ece-4f5e-b499-f0bc489482a9", {
        settings: {
          disableAutoBiometricsPrompt: true,
          otherStuff: "otherStuff4",
        },
        otherStuff: "otherStuff5",
      });
    });

    it("should not set disableAutoBiometricsPrompt to true on accounts if noAutoPromptBiometrics is false", async () => {
      const json = exampleJSON();
      json.global.noAutoPromptBiometrics = false;
      helper = mockMigrationHelper(json);
      await sut.migrate(helper);
      expect(helper.set).not.toHaveBeenCalledWith(
        matches((s) => s != "global"),
        any(),
      );
    });
  });

  describe("rollback", () => {
    it("should throw", async () => {
      await expect(sut.rollback(helper)).rejects.toThrow();
    });
  });

  describe("updateVersion", () => {
    it("should update version up", async () => {
      await sut.updateVersion(helper, "up");

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith(
        "global",
        Object.assign({}, exampleJSON().global, {
          stateVersion: 7,
        }),
      );
    });
  });
});
