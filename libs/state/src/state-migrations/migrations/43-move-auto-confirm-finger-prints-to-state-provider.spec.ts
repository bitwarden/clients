import { MockProxy } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper, runMigrator } from "../migration-helper.spec";

import { AutoConfirmFingerPrintsMigrator } from "./43-move-auto-confirm-finger-prints-to-state-provider";

function rollbackJSON() {
  return {
    authenticatedAccounts: ["user-1", "user-2"],
    "user_user-1_organizationManagementPreferences_autoConfirmFingerPrints": true,
    "user_user-2_organizationManagementPreferences_autoConfirmFingerPrints": false,
    "user-1": {
      settings: {
        extra: "data",
      },
      extra: "data",
    },
    "user-2": {
      settings: {
        extra: "data",
      },
      extra: "data",
    },
  };
}

describe("AutoConfirmFingerPrintsMigrator", () => {
  const migrator = new AutoConfirmFingerPrintsMigrator(42, 43);

  it("should migrate the autoConfirmFingerPrints property from the account settings object to a user StorageKey", async () => {
    const output = await runMigrator(migrator, {
      authenticatedAccounts: ["user-1", "user-2"] as const,
      "user-1": {
        settings: {
          autoConfirmFingerPrints: true,
          extra: "data",
        },
        extra: "data",
      },
      "user-2": {
        settings: {
          autoConfirmFingerPrints: false,
          extra: "data",
        },
        extra: "data",
      },
    });

    expect(output).toEqual({
      authenticatedAccounts: ["user-1", "user-2"],
      "user_user-1_organizationManagementPreferences_autoConfirmFingerPrints": true,
      "user_user-2_organizationManagementPreferences_autoConfirmFingerPrints": false,
      "user-1": {
        settings: {
          extra: "data",
        },
        extra: "data",
      },
      "user-2": {
        settings: {
          extra: "data",
        },
        extra: "data",
      },
    });
  });

  describe("rollback", () => {
    let helper: MockProxy<MigrationHelper>;
    let sut: AutoConfirmFingerPrintsMigrator;

    const keyDefinitionLike = {
      key: "autoConfirmFingerPrints",
      stateDefinition: {
        name: "organizationManagementPreferences",
      },
    };

    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 43);
      sut = new AutoConfirmFingerPrintsMigrator(42, 43);
    });

    it("should null the autoConfirmFingerPrints user StorageKey for each account", async () => {
      await sut.rollback(helper);
      expect(helper.setToUser).toHaveBeenCalledWith("user-1", keyDefinitionLike, null);
    });

    it("should add the autoConfirmFingerPrints property back to the account settings object", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          autoConfirmFingerPrints: true,
          extra: "data",
        },
        extra: "data",
      });
    });
  });
});
