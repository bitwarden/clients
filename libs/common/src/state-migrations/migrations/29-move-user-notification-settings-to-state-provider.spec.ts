import { MockProxy } from "jest-mock-extended";

import { StateDefinitionLike, MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import { UserNotificationSettingsKeyMigrator } from "./29-move-user-notification-settings-to-state-provider";

function exampleJSON() {
  return {
    global: {
      disableAddLoginNotification: false,
      disableChangedPasswordNotification: false,
      otherStuff: "otherStuff1",
    },
  };
}

function rollbackJSON() {
  return {
    global_userNotificationSettings_enableAddedLoginPrompt: true,
    global_userNotificationSettings_enableChangedPasswordPrompt: true,
    global: {
      otherStuff: "otherStuff1",
    },
  };
}

const userNotificationSettingsLocalStateDefinition: {
  stateDefinition: StateDefinitionLike;
} = {
  stateDefinition: {
    name: "userNotificationSettings",
  },
};

describe("ProviderKeysMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: UserNotificationSettingsKeyMigrator;

  describe("migrate", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 28);
      sut = new UserNotificationSettingsKeyMigrator(28, 29);
    });

    it("should remove disableAddLoginNotification and disableChangedPasswordNotification global setting", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledTimes(2);
      expect(helper.set).toHaveBeenCalledWith("global", { otherStuff: "otherStuff1" });
      expect(helper.set).toHaveBeenCalledWith("global", { otherStuff: "otherStuff1" });
    });

    it("should set global user notification setting values", async () => {
      await sut.migrate(helper);

      expect(helper.setToGlobal).toHaveBeenCalledTimes(2);
      expect(helper.setToGlobal).toHaveBeenCalledWith(
        { ...userNotificationSettingsLocalStateDefinition, key: "enableAddedLoginPrompt" },
        true,
      );
      expect(helper.setToGlobal).toHaveBeenCalledWith(
        { ...userNotificationSettingsLocalStateDefinition, key: "enableChangedPasswordPrompt" },
        true,
      );
    });
  });

  describe("rollback", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 29);
      sut = new UserNotificationSettingsKeyMigrator(28, 29);
    });

    it("should null out new global values", async () => {
      await sut.rollback(helper);

      expect(helper.setToGlobal).toHaveBeenCalledTimes(2);
      expect(helper.setToGlobal).toHaveBeenCalledWith(
        { ...userNotificationSettingsLocalStateDefinition, key: "enableAddedLoginPrompt" },
        null,
      );
      expect(helper.setToGlobal).toHaveBeenCalledWith(
        { ...userNotificationSettingsLocalStateDefinition, key: "enableChangedPasswordPrompt" },
        null,
      );
    });

    it("should add explicit global values back", async () => {
      await sut.rollback(helper);

      expect(helper.set).toHaveBeenCalledTimes(2);
      expect(helper.set).toHaveBeenCalledWith("global", {
        disableAddLoginNotification: false,
        otherStuff: "otherStuff1",
      });
      expect(helper.set).toHaveBeenCalledWith("global", {
        disableChangedPasswordNotification: false,
        otherStuff: "otherStuff1",
      });
    });
  });
});
