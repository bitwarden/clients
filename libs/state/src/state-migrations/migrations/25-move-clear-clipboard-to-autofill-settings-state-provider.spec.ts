import { any, MockProxy } from "jest-mock-extended";

import { StateDefinitionLike, MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { ClearClipboardDelayMigrator } from "./25-move-clear-clipboard-to-autofill-settings-state-provider";

export const ClearClipboardDelay = {
  Never: null as null,
  TenSeconds: 10,
  TwentySeconds: 20,
  ThirtySeconds: 30,
  OneMinute: 60,
  TwoMinutes: 120,
  FiveMinutes: 300,
} as const;

const AutofillOverlayVisibility = {
  Off: 0,
  OnButtonClick: 1,
  OnFieldFocus: 2,
} as const;

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
    "user-1": {
      settings: {
        clearClipboard: ClearClipboardDelay.TenSeconds,
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      settings: {
        clearClipboard: ClearClipboardDelay.Never,
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
    "user-3": {
      settings: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

function rollbackJSON() {
  return {
    global_autofillSettingsLocal_inlineMenuVisibility: AutofillOverlayVisibility.OnButtonClick,
    "user_user-1_autofillSettingsLocal_clearClipboardDelay": ClearClipboardDelay.TenSeconds,
    "user_user-2_autofillSettingsLocal_clearClipboardDelay": ClearClipboardDelay.Never,
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
      settings: {
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
  };
}

const autofillSettingsLocalStateDefinition: {
  stateDefinition: StateDefinitionLike;
} = {
  stateDefinition: {
    name: "autofillSettingsLocal",
  },
};

describe("ClearClipboardDelayMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: ClearClipboardDelayMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 24);
      sut = new ClearClipboardDelayMigrator(24, 25);
    });

    it("should remove clearClipboard setting from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledTimes(2);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.set).toHaveBeenCalledWith("user-2", {
        settings: {
          otherStuff: "otherStuff4",
        },
        otherStuff: "otherStuff5",
      });
    });

    it("should set autofill setting values for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(2);
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...autofillSettingsLocalStateDefinition, key: "clearClipboardDelay" },
        ClearClipboardDelay.TenSeconds,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-2",
        { ...autofillSettingsLocalStateDefinition, key: "clearClipboardDelay" },
        ClearClipboardDelay.Never,
      );
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 25);
      sut = new ClearClipboardDelayMigrator(24, 25);
    });

    it("should null out new values for each account", async () => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(2);
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...autofillSettingsLocalStateDefinition, key: "clearClipboardDelay" },
        null,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-2",
        { ...autofillSettingsLocalStateDefinition, key: "clearClipboardDelay" },
        null,
      );
    });

    it("should add explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(2);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          clearClipboard: ClearClipboardDelay.TenSeconds,
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.set).toHaveBeenCalledWith("user-2", {
        settings: {
          clearClipboard: ClearClipboardDelay.Never,
          otherStuff: "otherStuff4",
        },
        otherStuff: "otherStuff5",
      });
    });

    it("should not try to restore values to missing accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).not.toHaveBeenCalledWith("user-3", any());
    });
  });
});
