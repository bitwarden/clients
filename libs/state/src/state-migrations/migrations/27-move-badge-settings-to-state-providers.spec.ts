import { any, MockProxy } from "jest-mock-extended";

import { StateDefinitionLike, MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { BadgeSettingsMigrator } from "./27-move-badge-settings-to-state-providers";

function exampleJSON() {
  return {
    global: {
      otherStuff: "otherStuff1",
    },
    authenticatedAccounts: ["user-1", "user-2", "user-3"],
    "user-1": {
      settings: {
        disableBadgeCounter: true,
        otherStuff: "otherStuff2",
      },
      otherStuff: "otherStuff3",
    },
    "user-2": {
      settings: {
        disableBadgeCounter: false,
        otherStuff: "otherStuff4",
      },
      otherStuff: "otherStuff5",
    },
    "user-3": {
      settings: {
        otherStuff: "otherStuff6",
      },
      otherStuff: "otherStuff7",
    },
  };
}

function rollbackJSON() {
  return {
    "user_user-1_badgeSettings_enableBadgeCounter": false,
    "user_user-2_badgeSettings_enableBadgeCounter": true,
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
    "user-3": {
      settings: {
        otherStuff: "otherStuff6",
      },
      otherStuff: "otherStuff7",
    },
  };
}

const badgeSettingsStateDefinition: {
  stateDefinition: StateDefinitionLike;
} = {
  stateDefinition: {
    name: "badgeSettings",
  },
};

describe("BadgeSettingsMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: BadgeSettingsMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 26);
      sut = new BadgeSettingsMigrator(26, 27);
    });

    it("should remove disableBadgeCounter setting from all accounts", async () => {
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

    it("should set badge setting values for each account", async () => {
      await sut.migrate(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(2);
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...badgeSettingsStateDefinition, key: "enableBadgeCounter" },
        false,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-2",
        { ...badgeSettingsStateDefinition, key: "enableBadgeCounter" },
        true,
      );
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 27);
      sut = new BadgeSettingsMigrator(26, 27);
    });

    it("should null out new values for each account", async () => {
      await sut.rollback(helper);

      expect(helper.setToUser).toHaveBeenCalledTimes(2);
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-1",
        { ...badgeSettingsStateDefinition, key: "enableBadgeCounter" },
        null,
      );
      expect(helper.setToUser).toHaveBeenCalledWith(
        "user-2",
        { ...badgeSettingsStateDefinition, key: "enableBadgeCounter" },
        null,
      );
    });

    it("should add explicit value back to accounts", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(2);
      expect(helper.set).toHaveBeenCalledWith("user-1", {
        settings: {
          disableBadgeCounter: true,
          otherStuff: "otherStuff2",
        },
        otherStuff: "otherStuff3",
      });
      expect(helper.set).toHaveBeenCalledWith("user-2", {
        settings: {
          disableBadgeCounter: false,
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
