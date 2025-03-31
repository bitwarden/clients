// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { StateDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

// FIXME: Remove when updating file. Eslint update
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AutofillOverlayVisibility = {
  Off: 0,
  OnButtonClick: 1,
  OnFieldFocus: 2,
} as const;

type InlineMenuVisibilitySetting =
  (typeof AutofillOverlayVisibility)[keyof typeof AutofillOverlayVisibility];

type ExpectedAccountState = {
  settings?: {
    autoFillOnPageLoadDefault?: boolean;
    enableAutoFillOnPageLoad?: boolean;
    dismissedAutoFillOnPageLoadCallout?: boolean;
    disableAutoTotpCopy?: boolean;
    activateAutoFillOnPageLoadFromPolicy?: InlineMenuVisibilitySetting;
  };
};

type ExpectedGlobalState = { autoFillOverlayVisibility?: InlineMenuVisibilitySetting };

const autofillSettingsStateDefinition: {
  stateDefinition: StateDefinitionLike;
} = {
  stateDefinition: {
    name: "autofillSettings",
  },
};

export class AutofillSettingsKeyMigrator extends Migrator<17, 18> {
  async migrate(helper: MigrationHelper): Promise<void> {
    // global state (e.g. "autoFillOverlayVisibility -> inlineMenuVisibility")
    const globalState = await helper.get<ExpectedGlobalState>("global");

    if (globalState?.autoFillOverlayVisibility != null) {
      await helper.setToGlobal(
        {
          stateDefinition: {
            name: "autofillSettingsLocal",
          },
          key: "inlineMenuVisibility",
        },
        globalState.autoFillOverlayVisibility,
      );

      // delete `autoFillOverlayVisibility` from state global
      delete globalState.autoFillOverlayVisibility;

      await helper.set<ExpectedGlobalState>("global", globalState);
    }

    // account state (e.g. account settings -> state provider framework keys)
    const accounts = await helper.getAccounts<ExpectedAccountState>();

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);

    // migrate account state
    async function migrateAccount(userId: string, account: ExpectedAccountState): Promise<void> {
      let updateAccount = false;
      const accountSettings = account?.settings;

      if (accountSettings?.autoFillOnPageLoadDefault != null) {
        await helper.setToUser(
          userId,
          { ...autofillSettingsStateDefinition, key: "autofillOnPageLoadDefault" },
          accountSettings.autoFillOnPageLoadDefault,
        );
        delete account.settings.autoFillOnPageLoadDefault;
        updateAccount = true;
      }

      if (accountSettings?.enableAutoFillOnPageLoad != null) {
        await helper.setToUser(
          userId,
          { ...autofillSettingsStateDefinition, key: "autofillOnPageLoad" },
          accountSettings?.enableAutoFillOnPageLoad,
        );
        delete account.settings.enableAutoFillOnPageLoad;
        updateAccount = true;
      }

      if (accountSettings?.dismissedAutoFillOnPageLoadCallout != null) {
        await helper.setToUser(
          userId,
          { ...autofillSettingsStateDefinition, key: "autofillOnPageLoadCalloutIsDismissed" },
          accountSettings?.dismissedAutoFillOnPageLoadCallout,
        );
        delete account.settings.dismissedAutoFillOnPageLoadCallout;
        updateAccount = true;
      }

      if (accountSettings?.disableAutoTotpCopy != null) {
        await helper.setToUser(
          userId,
          { ...autofillSettingsStateDefinition, key: "autoCopyTotp" },
          // invert the value to match the new naming convention
          !accountSettings?.disableAutoTotpCopy,
        );
        delete account.settings.disableAutoTotpCopy;
        updateAccount = true;
      }

      if (accountSettings?.activateAutoFillOnPageLoadFromPolicy != null) {
        await helper.setToUser(
          userId,
          {
            stateDefinition: {
              name: "autofillSettingsLocal",
            },
            key: "activateAutofillOnPageLoadFromPolicy",
          },
          accountSettings?.activateAutoFillOnPageLoadFromPolicy,
        );
        delete account.settings.activateAutoFillOnPageLoadFromPolicy;
        updateAccount = true;
      }

      if (updateAccount) {
        // update the state account settings with the migrated values deleted
        await helper.set(userId, account);
      }
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    // global state (e.g. "inlineMenuVisibility -> autoFillOverlayVisibility")
    const globalState = (await helper.get<ExpectedGlobalState>("global")) || {};
    const inlineMenuVisibility: InlineMenuVisibilitySetting = await helper.getFromGlobal({
      stateDefinition: {
        name: "autofillSettingsLocal",
      },
      key: "inlineMenuVisibility",
    });

    if (inlineMenuVisibility) {
      await helper.set<ExpectedGlobalState>("global", {
        ...globalState,
        autoFillOverlayVisibility: inlineMenuVisibility,
      });

      // remove the global state provider framework key for `inlineMenuVisibility`
      await helper.setToGlobal(
        {
          stateDefinition: {
            name: "autofillSettingsLocal",
          },
          key: "inlineMenuVisibility",
        },
        null,
      );
    }

    // account state (e.g. state provider framework keys -> account settings)
    const accounts = await helper.getAccounts<ExpectedAccountState>();

    await Promise.all([...accounts.map(({ userId, account }) => rollbackAccount(userId, account))]);

    // rollback account state
    async function rollbackAccount(userId: string, account: ExpectedAccountState): Promise<void> {
      let updateAccount = false;
      let settings = account?.settings || {};

      const autoFillOnPageLoadDefault: boolean = await helper.getFromUser(userId, {
        ...autofillSettingsStateDefinition,
        key: "autofillOnPageLoadDefault",
      });

      const enableAutoFillOnPageLoad: boolean = await helper.getFromUser(userId, {
        ...autofillSettingsStateDefinition,
        key: "autofillOnPageLoad",
      });

      const dismissedAutoFillOnPageLoadCallout: boolean = await helper.getFromUser(userId, {
        ...autofillSettingsStateDefinition,
        key: "autofillOnPageLoadCalloutIsDismissed",
      });

      const autoCopyTotp: boolean = await helper.getFromUser(userId, {
        ...autofillSettingsStateDefinition,
        key: "autoCopyTotp",
      });

      const activateAutoFillOnPageLoadFromPolicy: InlineMenuVisibilitySetting =
        await helper.getFromUser(userId, {
          stateDefinition: {
            name: "autofillSettingsLocal",
          },
          key: "activateAutofillOnPageLoadFromPolicy",
        });

      // update new settings and remove the account state provider framework keys for the rolled back values
      if (autoFillOnPageLoadDefault != null) {
        settings = { ...settings, autoFillOnPageLoadDefault };

        await helper.setToUser(
          userId,
          { ...autofillSettingsStateDefinition, key: "autofillOnPageLoadDefault" },
          null,
        );

        updateAccount = true;
      }

      if (enableAutoFillOnPageLoad != null) {
        settings = { ...settings, enableAutoFillOnPageLoad };

        await helper.setToUser(
          userId,
          { ...autofillSettingsStateDefinition, key: "autofillOnPageLoad" },
          null,
        );

        updateAccount = true;
      }

      if (dismissedAutoFillOnPageLoadCallout != null) {
        settings = { ...settings, dismissedAutoFillOnPageLoadCallout };

        await helper.setToUser(
          userId,
          { ...autofillSettingsStateDefinition, key: "autofillOnPageLoadCalloutIsDismissed" },
          null,
        );

        updateAccount = true;
      }

      if (autoCopyTotp != null) {
        // invert the value to match the new naming convention
        settings = { ...settings, disableAutoTotpCopy: !autoCopyTotp };

        await helper.setToUser(
          userId,
          { ...autofillSettingsStateDefinition, key: "autoCopyTotp" },
          null,
        );

        updateAccount = true;
      }

      if (activateAutoFillOnPageLoadFromPolicy != null) {
        settings = { ...settings, activateAutoFillOnPageLoadFromPolicy };

        await helper.setToUser(
          userId,
          {
            stateDefinition: {
              name: "autofillSettingsLocal",
            },
            key: "activateAutofillOnPageLoadFromPolicy",
          },
          null,
        );

        updateAccount = true;
      }

      if (updateAccount) {
        // commit updated settings to state
        await helper.set(userId, {
          ...account,
          settings,
        });
      }
    }
  }
}
