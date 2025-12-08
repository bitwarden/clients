import { MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedGlobalState = {
  disableAddLoginNotification?: boolean;
  disableChangedPasswordNotification?: boolean;
};

export class UserNotificationSettingsKeyMigrator extends Migrator<28, 29> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const globalState = await helper.get<ExpectedGlobalState>("global");

    // disableAddLoginNotification -> enableAddedLoginPrompt
    if (globalState?.disableAddLoginNotification != null) {
      await helper.setToGlobal(
        {
          stateDefinition: {
            name: "userNotificationSettings",
          },
          key: "enableAddedLoginPrompt",
        },
        !globalState.disableAddLoginNotification,
      );

      // delete `disableAddLoginNotification` from state global
      delete globalState.disableAddLoginNotification;

      await helper.set<ExpectedGlobalState>("global", globalState);
    }

    // disableChangedPasswordNotification -> enableChangedPasswordPrompt
    if (globalState?.disableChangedPasswordNotification != null) {
      await helper.setToGlobal(
        {
          stateDefinition: {
            name: "userNotificationSettings",
          },
          key: "enableChangedPasswordPrompt",
        },
        !globalState.disableChangedPasswordNotification,
      );

      // delete `disableChangedPasswordNotification` from state global
      delete globalState.disableChangedPasswordNotification;

      await helper.set<ExpectedGlobalState>("global", globalState);
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const globalState = (await helper.get<ExpectedGlobalState>("global")) || {};

    const enableAddedLoginPrompt: boolean = await helper.getFromGlobal({
      stateDefinition: {
        name: "userNotificationSettings",
      },
      key: "enableAddedLoginPrompt",
    });

    const enableChangedPasswordPrompt: boolean = await helper.getFromGlobal({
      stateDefinition: {
        name: "userNotificationSettings",
      },
      key: "enableChangedPasswordPrompt",
    });

    // enableAddedLoginPrompt -> disableAddLoginNotification
    if (enableAddedLoginPrompt) {
      await helper.set<ExpectedGlobalState>("global", {
        ...globalState,
        disableAddLoginNotification: !enableAddedLoginPrompt,
      });

      // remove the global state provider framework key for `enableAddedLoginPrompt`
      await helper.setToGlobal(
        {
          stateDefinition: {
            name: "userNotificationSettings",
          },
          key: "enableAddedLoginPrompt",
        },
        null,
      );
    }

    // enableChangedPasswordPrompt -> disableChangedPasswordNotification
    if (enableChangedPasswordPrompt) {
      await helper.set<ExpectedGlobalState>("global", {
        ...globalState,
        disableChangedPasswordNotification: !enableChangedPasswordPrompt,
      });

      // remove the global state provider framework key for `enableChangedPasswordPrompt`
      await helper.setToGlobal(
        {
          stateDefinition: {
            name: "userNotificationSettings",
          },
          key: "enableChangedPasswordPrompt",
        },
        null,
      );
    }
  }
}
