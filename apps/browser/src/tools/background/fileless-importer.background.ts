import { firstValueFrom } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ImportServiceAbstraction } from "@bitwarden/importer/core";

import NotificationBackground from "../../autofill/background/notification.background";
import { BrowserApi } from "../../platform/browser/browser-api";
import { FilelessImporterInjectedScriptsConfig } from "../config/fileless-importer-injected-scripts";
import {
  FilelessImportPort,
  FilelessImportType,
  FilelessImportTypeKeys,
} from "../enums/fileless-import.enums";

import {
  ImportNotificationMessageHandlers,
  LpImporterMessageHandlers,
  FilelessImporterBackground as FilelessImporterBackgroundInterface,
  FilelessImportPortMessage,
  SuppressDownloadScriptInjectionConfig,
} from "./abstractions/fileless-importer.background";

class FilelessImporterBackground implements FilelessImporterBackgroundInterface {
  private static readonly filelessImporterPortNames: Set<string> = new Set([
    FilelessImportPort.LpImporter,
    FilelessImportPort.NotificationBar,
  ]);
  private importNotificationsPort: chrome.runtime.Port;
  private lpImporterPort: chrome.runtime.Port;
  private readonly importNotificationsPortMessageHandlers: ImportNotificationMessageHandlers = {
    startFilelessImport: ({ message }) => this.startFilelessImport(message.importType),
    cancelFilelessImport: ({ message, port }) =>
      this.cancelFilelessImport(message.importType, port.sender),
  };
  private readonly lpImporterPortMessageHandlers: LpImporterMessageHandlers = {
    displayLpImportNotification: ({ port }) =>
      this.displayFilelessImportNotification(port.sender.tab, FilelessImportType.LP),
    startLpImport: ({ message }) => this.triggerLpImport(message.data),
  };

  /**
   * Creates a new instance of the fileless importer background logic.
   *
   * @param configService - Identifies if the feature flag is enabled.
   * @param authService - Verifies if the auth status of the user.
   * @param policyService - Identifies if the user account has a policy that disables personal ownership.
   * @param notificationBackground - Used to inject the notification bar into the tab.
   * @param importService - Used to import the export data into the vault.
   * @param syncService - Used to trigger a full sync after the import is completed.
   */
  constructor(
    private configService: ConfigServiceAbstraction,
    private authService: AuthService,
    private policyService: PolicyService,
    private notificationBackground: NotificationBackground,
    private importService: ImportServiceAbstraction,
    private syncService: SyncService,
  ) {}

  /**
   * Initializes the fileless importer background logic.
   */
  init() {
    this.setupPortMessageListeners();
  }

  /**
   * Starts an import of the export data pulled from the tab.
   *
   * @param importType - The type of import to start. Identifies the used content script.
   */
  private startFilelessImport(importType: FilelessImportTypeKeys) {
    if (importType === FilelessImportType.LP) {
      this.lpImporterPort?.postMessage({ command: "startLpFilelessImport" });
    }
  }

  /**
   * Cancels an import of the export data pulled from the tab. This closes any
   * existing notifications that are present in the tab, and triggers importer
   * specific behavior based on the import type.
   *
   * @param importType - The type of import to cancel. Identifies the used content script.
   * @param sender - The sender of the message.
   */
  private async cancelFilelessImport(
    importType: FilelessImportTypeKeys,
    sender: chrome.runtime.MessageSender,
  ) {
    if (importType === FilelessImportType.LP) {
      this.triggerLpImporterCsvDownload();
    }

    await BrowserApi.tabSendMessage(sender.tab, { command: "closeNotificationBar" });
  }

  /**
   * Injects the notification bar into the passed tab.
   *
   * @param tab
   * @param importType
   */
  private async displayFilelessImportNotification(tab: chrome.tabs.Tab, importType: string) {
    await this.notificationBackground.requestFilelessImport(tab, importType);
  }

  /**
   * Injects the script used to suppress the download of the LP importer export file.
   *
   * @param sender - The sender of the message.
   * @param injectionConfig - The configuration for the injection.
   */
  private async injectScriptConfig(
    sender: chrome.runtime.MessageSender,
    injectionConfig: SuppressDownloadScriptInjectionConfig,
  ) {
    await BrowserApi.executeScriptInTab(
      sender.tab.id,
      { file: injectionConfig.file, runAt: "document_start" },
      injectionConfig.scriptingApiDetails,
    );
  }

  /**
   * Triggers the download of the CSV file from the LP importer. This is triggered
   * when the user opts to not save the export to Bitwarden within the notification bar.
   */
  private triggerLpImporterCsvDownload() {
    this.lpImporterPort?.postMessage({ command: "triggerCsvDownload" });
    this.lpImporterPort?.disconnect();
  }

  /**
   * Completes the import process for the LP importer. This is triggered when the
   * user opts to save the export to Bitwarden within the notification bar.
   *
   * @param data - The export data to import.
   * @param sender - The sender of the message.
   */
  private async triggerLpImport(data: string) {
    if (!data) {
      return;
    }

    const promptForPassword_callback = async () => "";
    const importer = this.importService.getImporter(
      "lastpasscsv",
      promptForPassword_callback,
      null,
    );

    try {
      const result = await this.importService.import(importer, data, null, null, false);
      if (result.success) {
        this.importNotificationsPort?.postMessage({ command: "filelessImportCompleted" });
        await this.syncService.fullSync(true);
      }
    } catch (error) {
      this.importNotificationsPort?.postMessage({
        command: "filelessImportFailed",
        importErrorMessage: Object.values(error).length
          ? error
          : chrome.i18n.getMessage("importNetworkError"),
      });
    }
  }

  /**
   * Identifies if the user account has a policy that disables personal ownership.
   */
  private async removeIndividualVault(): Promise<boolean> {
    return await firstValueFrom(
      this.policyService.policyAppliesToActiveUser$(PolicyType.PersonalOwnership),
    );
  }

  /**
   * Sets up onConnect listeners for the extension.
   */
  private setupPortMessageListeners() {
    chrome.runtime.onConnect.addListener(this.handlePortOnConnect);
  }

  /**
   * Handles connections from content scripts that affect the fileless importer behavior.
   * Is used to facilitate the passing of data and user actions to enact the import
   * of web content to the Bitwarden vault. Along with this, a check is made to ensure
   * that the feature flag is enabled and the user is authenticated.
   */
  private handlePortOnConnect = async (port: chrome.runtime.Port) => {
    if (!FilelessImporterBackground.filelessImporterPortNames.has(port.name)) {
      return;
    }

    const filelessImportFeatureFlagEnabled = await this.configService.getFeatureFlag<boolean>(
      FeatureFlag.BrowserFilelessImport,
    );
    const userAuthStatus = await this.authService.getAuthStatus();
    const removeIndividualVault = await this.removeIndividualVault();
    const filelessImportEnabled =
      filelessImportFeatureFlagEnabled &&
      userAuthStatus === AuthenticationStatus.Unlocked &&
      !removeIndividualVault;
    port.postMessage({ command: "verifyFeatureFlag", filelessImportEnabled });

    if (!filelessImportEnabled) {
      return;
    }

    port.onMessage.addListener(this.handleImporterPortMessage);
    port.onDisconnect.addListener(this.handleImporterPortDisconnect);

    switch (port.name) {
      case FilelessImportPort.LpImporter:
        this.lpImporterPort = port;
        await this.injectScriptConfig(
          port.sender,
          BrowserApi.manifestVersion === 3
            ? FilelessImporterInjectedScriptsConfig.LpSuppressImportDownload.mv3
            : FilelessImporterInjectedScriptsConfig.LpSuppressImportDownload.mv2,
        );
        break;
      case FilelessImportPort.NotificationBar:
        this.importNotificationsPort = port;
        break;
    }
  };

  /**
   * Handles messages that are sent from fileless importer content scripts.
   * @param message - The message that was sent.
   * @param port - The port that the message was sent from.
   */
  private handleImporterPortMessage = (
    message: FilelessImportPortMessage,
    port: chrome.runtime.Port,
  ) => {
    let handler: CallableFunction | undefined;

    switch (port.name) {
      case FilelessImportPort.LpImporter:
        handler = this.lpImporterPortMessageHandlers[message.command];
        break;
      case FilelessImportPort.NotificationBar:
        handler = this.importNotificationsPortMessageHandlers[message.command];
        break;
    }

    if (!handler) {
      return;
    }

    handler({ message, port });
  };

  /**
   * Handles disconnections from fileless importer content scripts.
   * @param port - The port that was disconnected.
   */
  private handleImporterPortDisconnect = (port: chrome.runtime.Port) => {
    switch (port.name) {
      case FilelessImportPort.LpImporter:
        this.lpImporterPort = null;
        break;
      case FilelessImportPort.NotificationBar:
        this.importNotificationsPort = null;
        break;
    }
  };
}

export default FilelessImporterBackground;
