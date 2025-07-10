import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { VaultSettingsKeyMigrator } from "./36-move-show-card-and-identity-to-state-provider";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
    "user-1": {
      settings: {
        dontShowCardsCurrentTab: true,
        dontShowIdentitiesCurrentTab: true,
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
    "user_user-1_vaultSettings_showCardsCurrentTab": true,
    "user_user-1_vaultSettings_showIdentitiesCurrentTab": true,
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

const vaultSettingsStateDefinition: {
  stateDefinition: StateDefinitionLike;
} = {
  stateDefinition: {
    name: "vaultSettings",
  },
};

describe("VaultSettingsKeyMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: VaultSettingsKeyMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 35);
      sut = new VaultSettingsKeyMigrator(35, 36);
    });

    it("should remove dontShowCardsCurrentTab and dontShowIdentitiesCurrentTab from all accounts", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
    });

    it("should set showCardsCurrentTab and showIdentitiesCurrentTab values for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(2);
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...vaultSettingsStateDefinition, key: "showCardsCurrentTab" },
        false,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...vaultSettingsStateDefinition, key: "showIdentitiesCurrentTab" },
        false,
      );
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 36);
      sut = new VaultSettingsKeyMigrator(35, 36);
    });

    it("should null out new values for each account", async () => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(2);
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...vaultSettingsStateDefinition, key: "showCardsCurrentTab" },
        null,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...vaultSettingsStateDefinition, key: "showIdentitiesCurrentTab" },
        null,
      );
    });

    it("should add explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(1);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          otherStuff: "otherStuff2",
          dontShowCardsCurrentTab: false,
          dontShowIdentitiesCurrentTab: false,
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
