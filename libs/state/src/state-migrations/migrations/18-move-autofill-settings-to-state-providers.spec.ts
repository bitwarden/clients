import { any, MockProxy } from "jest-mock-extended";

import { StateDefinitionLike, MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { AutofillSettingsKeyMigrator } from "./18-move-autofill-settings-to-state-providers";

const AutofillOverlayVisibility = {
  Off: 0,
  OnButtonClick: 1,
  OnFieldFocus: 2,
} as const;

function exampleJSON() {
  return {
    global: {
      autoFillOverlayVisibility: AutofillOverlayVisibility.OnButtonClick,
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
    "user-1": {
      settings: {
        autoFillOnPageLoadDefault: true,
        enableAutoFillOnPageLoad: true,
        dismissedAutoFillOnPageLoadCallout: true,
        disableAutoTotpCopy: false,
        activateAutoFillOnPageLoadFromPolicy: true,
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

function rollbackJSON() {
  return {
    global_autofillSettingsLocal_inlineMenuVisibility: AutofillOverlayVisibility.OnButtonClick,
    "user_user-1_autofillSettings_autoCopyTotp": true,
    "user_user-1_autofillSettings_autofillOnPageLoad": true,
    "user_user-1_autofillSettings_autofillOnPageLoadCalloutIsDismissed": true,
    "user_user-1_autofillSettings_autofillOnPageLoadDefault": true,
    "user_user-1_autofillSettingsLocal_activateAutofillOnPageLoadFromPolicy": true,
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

const autofillSettingsStateDefinition: {
  stateDefinition: StateDefinitionLike;
} = {
  stateDefinition: {
    name: "autofillSettings",
  },
};

describe("AutofillSettingsKeyMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: AutofillSettingsKeyMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 17);
      sut = new AutofillSettingsKeyMigrator(17, 18);
    });

    it("should remove autofill settings from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledTimes(2);
      expect(helper.set).toHaveBeenCalledWith("global", {
        otherStuff: "otherStuff1",
      });
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should set autofill setting values for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToGlobal).toHaveBeenCalledTimes(1);
      expect(helper.setToGlobal).toHaveBeenCalledWith(
        {
          stateDefinition: {
            name: "autofillSettingsLocal",
          },
          key: "inlineMenuVisibility",
        },
        1,
      );

      expect(helper.setToUser).toHaveBeenCalledTimes(5);
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...autofillSettingsStateDefinition, key: "autofillOnPageLoadDefault" },
        true,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...autofillSettingsStateDefinition, key: "autofillOnPageLoad" },
        true,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...autofillSettingsStateDefinition, key: "autofillOnPageLoadCalloutIsDismissed" },
        true,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...autofillSettingsStateDefinition, key: "autoCopyTotp" },
        true,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        {
          stateDefinition: {
            name: "autofillSettingsLocal",
          },
          key: "activateAutofillOnPageLoadFromPolicy",
        },
        true,
      );
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 18);
      sut = new AutofillSettingsKeyMigrator(17, 18);
    });

    it("should null out new values for each account", async () => {
      await sut.rollback(helper);

      expect(helper.setToGlobal).toHaveBeenCalledTimes(1);
      expect(helper.setToGlobal).toHaveBeenCalledWith(
        {
          stateDefinition: {
            name: "autofillSettingsLocal",
          },
          key: "inlineMenuVisibility",
        },
        null,
      );

      expect(helper.setToUser).toHaveBeenCalledTimes(5);
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...autofillSettingsStateDefinition, key: "autofillOnPageLoadDefault" },
        null,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...autofillSettingsStateDefinition, key: "autofillOnPageLoad" },
        null,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...autofillSettingsStateDefinition, key: "autofillOnPageLoadCalloutIsDismissed" },
        null,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...autofillSettingsStateDefinition, key: "autoCopyTotp" },
        null,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        {
          stateDefinition: {
            name: "autofillSettingsLocal",
          },
          key: "activateAutofillOnPageLoadFromPolicy",
        },
        null,
      );
    });

    it("should add explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(2);
      expect(helper.set).toHaveBeenCalledWith("global", {
        autoFillOverlayVisibility: 1,
        otherStuff: "otherStuff1",
      });
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          otherStuff: "otherStuff2",
          autoFillOnPageLoadDefault: true,
          enableAutoFillOnPageLoad: true,
          dismissedAutoFillOnPageLoadCallout: true,
          disableAutoTotpCopy: false,
          activateAutoFillOnPageLoadFromPolicy: true,
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should not try to restore values to missing accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).not.toHaveBeenCalledWith("user-3", any());
    });
  });
});
