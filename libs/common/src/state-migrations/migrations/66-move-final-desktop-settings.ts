import { KeyDefinitionLike, MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { Migrator } from "../migrator";

type ExpectedGlobal = {
  enableBrowserIntegration?: boolean;
  enableBrowserIntegrationFingerprint?: boolean;
};

type ExpectedAccount = {
  settings?: {
    minimizeOnCopyToClipboard?: boolean;
  };
};

const DESKTOP_SETTINGS_DISK: StateDefinitionLike = {
  name: "desktopSettings",
};

const BROWSER_INTEGRATION_ENABLED: KeyDefinitionLike = {
  key: "browserIntegrationEnabled",
  stateDefinition: DESKTOP_SETTINGS_DISK,
};

const BROWSER_INTEGRATION_FINGERPRINT_ENABLED: KeyDefinitionLike = {
  key: "browserIntegrationFingerprintEnabled",
  stateDefinition: DESKTOP_SETTINGS_DISK,
};

const MINIMIZE_ON_COPY: KeyDefinitionLike = {
  key: "minimizeOnCopy",
  stateDefinition: DESKTOP_SETTINGS_DISK,
};

export class MoveFinalDesktopSettingsMigrator extends Migrator<65, 66> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const legacyGlobal = await helper.get<ExpectedGlobal>("global");
    const enableBrowserIntegrationValue = legacyGlobal?.enableBrowserIntegration;
    const enableBrowserIntegrationFingerprintValue =
      legacyGlobal?.enableBrowserIntegrationFingerprint;

    let updatedGlobal = false;

    if (enableBrowserIntegrationValue != null) {
      await helper.setToGlobal(BROWSER_INTEGRATION_ENABLED, enableBrowserIntegrationValue);
      delete legacyGlobal.enableBrowserIntegration;
      updatedGlobal = true;
    }

    if (enableBrowserIntegrationFingerprintValue != null) {
      await helper.setToGlobal(
        BROWSER_INTEGRATION_FINGERPRINT_ENABLED,
        enableBrowserIntegrationFingerprintValue,
      );
      delete legacyGlobal.enableBrowserIntegrationFingerprint;
      updatedGlobal = true;
    }

    if (updatedGlobal) {
      await helper.set("global", legacyGlobal);
    }

    async function migrateAccount(userId: string, account: ExpectedAccount) {
      const minimizeOnCopyToClipboardValue = account?.settings?.minimizeOnCopyToClipboard;

      if (minimizeOnCopyToClipboardValue != null) {
        await helper.setToUser(userId, MINIMIZE_ON_COPY, minimizeOnCopyToClipboardValue);
        delete account.settings.minimizeOnCopyToClipboard;
        await helper.set(userId, account);
      }
    }

    const accounts = await helper.getAccounts<ExpectedAccount>();

    await Promise.all(accounts.map(({ userId, account }) => migrateAccount(userId, account)));
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const browserIntegrationEnabledValue = await helper.getFromGlobal<boolean>(
      BROWSER_INTEGRATION_ENABLED,
    );

    const browserIntegrationFingerprintEnabled = await helper.getFromGlobal<boolean>(
      BROWSER_INTEGRATION_FINGERPRINT_ENABLED,
    );

    if (browserIntegrationEnabledValue != null) {
      let legacyGlobal = await helper.get<ExpectedGlobal>("global");
      legacyGlobal ??= {};
      legacyGlobal.enableBrowserIntegration = browserIntegrationEnabledValue;
      await helper.set("global", legacyGlobal);
      await helper.removeFromGlobal(BROWSER_INTEGRATION_ENABLED);
    }

    if (browserIntegrationFingerprintEnabled != null) {
      let legacyGlobal = await helper.get<ExpectedGlobal>("global");
      legacyGlobal ??= {};
      legacyGlobal.enableBrowserIntegrationFingerprint = browserIntegrationFingerprintEnabled;
      await helper.set("global", legacyGlobal);
      await helper.removeFromGlobal(BROWSER_INTEGRATION_FINGERPRINT_ENABLED);
    }

    async function rollbackAccount(userId: string, account: ExpectedAccount) {
      const minimizeOnCopyToClipboardValue = await helper.getFromUser<boolean>(
        userId,
        MINIMIZE_ON_COPY,
      );

      if (minimizeOnCopyToClipboardValue != null) {
        account ??= { settings: {} };
        account.settings.minimizeOnCopyToClipboard = minimizeOnCopyToClipboardValue;
        await helper.set(userId, account);
        await helper.removeFromUser(userId, MINIMIZE_ON_COPY);
      }
    }

    const accounts = await helper.getAccounts();
    await Promise.all(accounts.map(({ userId, account }) => rollbackAccount(userId, account)));
  }
}
