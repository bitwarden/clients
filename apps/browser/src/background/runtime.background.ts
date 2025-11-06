// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map, mergeMap } from "rxjs";

import { LockService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutofillOverlayVisibility, ExtensionCommand } from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/abstractions/process-reload.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { MessageListener, isExternalMessage } from "@bitwarden/common/platform/messaging";
import { devFlagEnabled } from "@bitwarden/common/platform/misc/flags";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherType } from "@bitwarden/common/vault/enums";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";
import { BiometricsCommands } from "@bitwarden/key-management";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import {
  closeUnlockPopout,
  openSsoAuthResultPopout,
  openTwoFactorAuthWebAuthnPopout,
} from "../auth/popup/utils/auth-popout-window";
import { LockedVaultPendingNotificationsData } from "../autofill/background/abstractions/notification.background";
import { AutofillService } from "../autofill/services/abstractions/autofill.service";
import { BrowserApi } from "../platform/browser/browser-api";
import { BrowserEnvironmentService } from "../platform/services/browser-environment.service";
import BrowserInitialInstallService from "../platform/services/browser-initial-install.service";
import { BrowserPlatformUtilsService } from "../platform/services/platform-utils/browser-platform-utils.service";

import MainBackground from "./main.background";

export default class RuntimeBackground {
  private autofillTimeout: any;
  private pageDetailsToAutoFill: any[] = [];
  private onInstalledReason: string = null;
  private lockedVaultPendingNotifications: LockedVaultPendingNotificationsData[] = [];

  constructor(
    private main: MainBackground,
    private autofillService: AutofillService,
    private platformUtilsService: BrowserPlatformUtilsService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private processReloadService: ProcessReloadServiceAbstraction,
    private environmentService: BrowserEnvironmentService,
    private messagingService: MessagingService,
    private logService: LogService,
    private configService: ConfigService,
    private messageListener: MessageListener,
    private accountService: AccountService,
    private readonly lockService: LockService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private browserInitialInstallService: BrowserInitialInstallService,
  ) {
    // onInstalled listener must be wired up before anything else, so we do it in the ctor
    chrome.runtime.onInstalled.addListener((details: any) => {
      this.onInstalledReason = details.reason;
    });
  }

  async init() {
    if (!chrome.runtime) {
      return;
    }

    await this.checkOnInstalled();
    const backgroundMessageListener = (
      msg: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: any) => void,
    ) => {
      const messagesWithResponse = [
        BiometricsCommands.AuthenticateWithBiometrics,
        BiometricsCommands.GetBiometricsStatus,
        BiometricsCommands.UnlockWithBiometricsForUser,
        BiometricsCommands.GetBiometricsStatusForUser,
        BiometricsCommands.CanEnableBiometricUnlock,
        "getUserPremiumStatus",
      ];

      if (messagesWithResponse.includes(msg.command)) {
        this.processMessageWithSender(msg, sender).then(
          (value) => sendResponse({ result: value }),
          (error) => sendResponse({ error: { ...error, message: error.message } }),
        );
        return true;
      }

      void this.processMessageWithSender(msg, sender).catch((err) =>
        this.logService.error(
          `Error while processing message in RuntimeBackground '${msg?.command}'.`,
          err,
        ),
      );
      return false;
    };

    this.messageListener.allMessages$
      .pipe(
        mergeMap(async (message: any) => {
          try {
            await this.processMessage(message);
          } catch (err) {
            this.logService.error(err);
          }
        }),
      )
      .subscribe();

    // For messages that require the full on message interface
    BrowserApi.messageListener("runtime.background", backgroundMessageListener);
  }

  // Messages that need the chrome sender and send back a response need to be registered in this method.
  async processMessageWithSender(msg: any, sender: chrome.runtime.MessageSender) {
    switch (msg.command) {
      case "triggerAutofillScriptInjection":
        await this.autofillService.injectAutofillScripts(sender.tab, sender.frameId);
        break;
      case "bgCollectPageDetails":
        await this.main.collectPageDetailsForContentScript(sender.tab, msg.sender, sender.frameId);
        break;
      case "collectPageDetailsResponse":
        switch (msg.sender) {
          case "autofiller":
          case ExtensionCommand.AutofillCommand: {
            const activeUserId = await firstValueFrom(
              this.accountService.activeAccount$.pipe(map((a) => a?.id)),
            );
            await this.accountService.setAccountActivity(activeUserId, new Date());
            const totpCode = await this.autofillService.doAutoFillActiveTab(
              [
                {
                  frameId: sender.frameId,
                  tab: msg.tab,
                  details: msg.details,
                },
              ],
              msg.sender === ExtensionCommand.AutofillCommand,
            );
            if (totpCode != null) {
              this.platformUtilsService.copyToClipboard(totpCode);
            }
            await this.main.updateOverlayCiphers();
            break;
          }
          case ExtensionCommand.AutofillCard: {
            await this.autofillService.doAutoFillActiveTab(
              [
                {
                  frameId: sender.frameId,
                  tab: msg.tab,
                  details: msg.details,
                },
              ],
              msg.sender === ExtensionCommand.AutofillCard,
              CipherType.Card,
            );
            break;
          }
          case ExtensionCommand.AutofillIdentity: {
            await this.autofillService.doAutoFillActiveTab(
              [
                {
                  frameId: sender.frameId,
                  tab: msg.tab,
                  details: msg.details,
                },
              ],
              msg.sender === ExtensionCommand.AutofillIdentity,
              CipherType.Identity,
            );
            break;
          }
          case "contextMenu":
            clearTimeout(this.autofillTimeout);
            this.pageDetailsToAutoFill.push({
              frameId: sender.frameId,
              tab: msg.tab,
              details: msg.details,
            });
            this.autofillTimeout = setTimeout(async () => await this.autofillPage(msg.tab), 300);
            break;
          default:
            break;
        }
        break;
      case BiometricsCommands.AuthenticateWithBiometrics: {
        return await this.main.biometricsService.authenticateWithBiometrics();
      }
      case BiometricsCommands.GetBiometricsStatus: {
        return await this.main.biometricsService.getBiometricsStatus();
      }
      case BiometricsCommands.UnlockWithBiometricsForUser: {
        return await this.main.biometricsService.unlockWithBiometricsForUser(msg.userId);
      }
      case BiometricsCommands.GetBiometricsStatusForUser: {
        return await this.main.biometricsService.getBiometricsStatusForUser(msg.userId);
      }
      case BiometricsCommands.CanEnableBiometricUnlock: {
        return await this.main.biometricsService.canEnableBiometricUnlock();
      }
      case "getUserPremiumStatus": {
        const activeUserId = await firstValueFrom(
          this.accountService.activeAccount$.pipe(map((a) => a?.id)),
        );
        const result = await firstValueFrom(
          this.billingAccountProfileStateService.hasPremiumFromAnySource$(activeUserId),
        );
        return result;
      }
    }
  }

  async processMessage(msg: any) {
    switch (msg.command) {
      case "loggedIn":
      case "unlocked": {
        let item: LockedVaultPendingNotificationsData;

        if (msg.command === "loggedIn") {
          await this.main.initOverlayAndTabsBackground();
          await this.sendBwInstalledMessageToVault();
          await this.autofillService.reloadAutofillScripts();
        }

        if (this.lockedVaultPendingNotifications?.length > 0) {
          item = this.lockedVaultPendingNotifications.pop();
          await closeUnlockPopout();
        }

        this.processReloadService.cancelProcessReload();

        if (item) {
          await BrowserApi.focusWindow(item.commandToRetry.sender.tab.windowId);
          await BrowserApi.focusTab(item.commandToRetry.sender.tab.id);
          await BrowserApi.tabSendMessageData(
            item.commandToRetry.sender.tab,
            "unlockCompleted",
            item,
          );
        }

        // @TODO these need to happen last to avoid blocking `tabSendMessageData` above
        // The underlying cause exists within `cipherService.getAllDecrypted` via
        // `getAllDecryptedForUrl` and is anticipated to be refactored
        await this.main.refreshMenu(false);

        await this.autofillService.setAutoFillOnPageLoadOrgPolicy();
        break;
      }
      case "addToLockedVaultPendingNotifications":
        this.lockedVaultPendingNotifications.push(msg.data);
        break;
      case "lockVault":
        await this.lockService.lock(msg.userId);
        break;
      case "lockAll":
        {
          await this.lockService.lockAll();
          this.messagingService.send("lockAllFinished", { requestId: msg.requestId });
        }
        break;
      case "lockUser":
        {
          await this.lockService.lock(msg.userId);
          this.messagingService.send("lockUserFinished", {
            requestId: msg.requestId,
          });
        }
        break;
      case "logout":
        await this.main.logout(msg.expired, msg.userId);
        break;
      case "syncCompleted":
        if (msg.successfully) {
          setTimeout(async () => {
            await this.main.refreshMenu();
          }, 2000);
          await this.configService.ensureConfigFetched();
          await this.main.updateOverlayCiphers();

          await this.autofillService.setAutoFillOnPageLoadOrgPolicy();
        }
        break;
      case "openPopup":
        await this.openPopup();
        break;
      case VaultMessages.OpenAtRiskPasswords:
        await this.main.openAtRisksPasswordsPage();
        this.announcePopupOpen();
        break;
      case VaultMessages.OpenBrowserExtensionToUrl: {
        // validate referrer to prevent any web page from forcing open
        const env = await firstValueFrom(this.environmentService.environment$);
        const vaultUrl = env.getWebVaultUrl();
        const referrer = msg.referrer;

        // this command should only come from web vault
        if (referrer == null) {
          // no referrer means not from web vault
          return;
        }

        const vaultHostname = Utils.getHostname(vaultUrl);
        if (vaultHostname == null || vaultHostname !== referrer) {
          // referrer doesn't match vault
          return;
        }

        await this.main.openTheExtensionToPage(msg.url);
        this.announcePopupOpen();
        break;
      }
      case "bgUpdateContextMenu":
      case "editedCipher":
      case "addedCipher":
      case "deletedCipher":
        await this.main.refreshMenu();
        break;
      case "bgReseedStorage": {
        await this.main.reseedStorage();
        break;
      }
      case "authResult": {
        const env = await firstValueFrom(this.environmentService.environment$);
        const vaultUrl = env.getWebVaultUrl();

        if (msg.referrer == null || Utils.getHostname(vaultUrl) !== msg.referrer) {
          return;
        }

        if (msg.lastpass) {
          this.messagingService.send("importCallbackLastPass", {
            code: msg.code,
            state: msg.state,
          });
        } else {
          try {
            await openSsoAuthResultPopout(msg);
          } catch {
            this.logService.error("Unable to open sso popout tab");
          }
        }
        break;
      }
      case "webAuthnResult": {
        const env = await firstValueFrom(this.environmentService.environment$);
        const vaultUrl = env.getWebVaultUrl();

        if (msg.referrer == null || Utils.getHostname(vaultUrl) !== msg.referrer) {
          return;
        }

        await openTwoFactorAuthWebAuthnPopout(msg);
        break;
      }
      case "reloadPopup":
        if (isExternalMessage(msg)) {
          this.messagingService.send("reloadPopup");
        }
        break;
      case "emailVerificationRequired":
        this.messagingService.send("showDialog", {
          title: { key: "emailVerificationRequired" },
          content: { key: "emailVerificationRequiredDesc" },
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
          type: "info",
        });
        break;
      case "getClickedElementResponse":
        this.platformUtilsService.copyToClipboard(msg.identifier);
        break;
      case "switchAccount": {
        await this.main.switchAccount(msg.userId);
        break;
      }
      case "clearClipboard": {
        await this.main.clearClipboard(msg.clipboardValue, msg.timeoutMs);
        break;
      }
    }
  }

  private async autofillPage(tabToAutoFill: chrome.tabs.Tab) {
    const totpCode = await this.autofillService.doAutoFill({
      tab: tabToAutoFill,
      cipher: this.main.loginToAutoFill,
      pageDetails: this.pageDetailsToAutoFill,
      fillNewPassword: true,
      allowTotpAutofill: true,
    });

    if (totpCode != null) {
      this.platformUtilsService.copyToClipboard(totpCode);
    }

    // reset
    this.main.loginToAutoFill = null;
    this.pageDetailsToAutoFill = [];
  }

  private async checkOnInstalled() {
    setTimeout(async () => {
      void this.autofillService.loadAutofillScriptsOnInstall();

      if (this.onInstalledReason != null) {
        if (
          this.onInstalledReason === "install" &&
          !(await firstValueFrom(this.browserInitialInstallService.extensionInstalled$))
        ) {
          if (!devFlagEnabled("skipWelcomeOnInstall")) {
            void BrowserApi.createNewTab("https://bitwarden.com/browser-start/");
          }

          await this.autofillSettingsService.setInlineMenuVisibility(
            AutofillOverlayVisibility.OnFieldFocus,
          );

          if (await this.environmentService.hasManagedEnvironment()) {
            await this.environmentService.setUrlsToManagedEnvironment();
          }
          await this.browserInitialInstallService.setExtensionInstalled(true);
        }

        this.onInstalledReason = null;
      }
    }, 100);
  }

  /** Returns the browser tabs that have the web vault open */
  private async getBwTabs() {
    const env = await firstValueFrom(this.environmentService.environment$);
    const vaultUrl = env.getWebVaultUrl();
    const urlObj = new URL(vaultUrl);

    return await BrowserApi.tabsQuery({ url: `${urlObj.href}*` });
  }

  /**
   * Opens the popup.
   *
   * @deprecated Migrating to the browser actions service.
   */
  private async openPopup() {
    await this.main.openPopup();
  }

  async sendBwInstalledMessageToVault() {
    try {
      const tabs = await this.getBwTabs();

      if (!tabs?.length) {
        return;
      }

      for (const tab of tabs) {
        await BrowserApi.executeScriptInTab(tab.id, {
          file: "content/send-on-installed-message.js",
          runAt: "document_end",
        });
      }
    } catch (e) {
      this.logService.error(`Error sending on installed message to vault: ${e}`);
    }
  }

  /** Sends a message to each tab that the popup was opened */
  private announcePopupOpen() {
    const announceToAllTabs = async () => {
      const isOpen = await this.platformUtilsService.isPopupOpen();
      const tabs = await this.getBwTabs();

      if (isOpen && tabs.length > 0) {
        // Send message to all vault tabs that the extension has opened
        for (const tab of tabs) {
          await BrowserApi.executeScriptInTab(tab.id, {
            file: "content/send-popup-open-message.js",
            runAt: "document_end",
          });
        }
      }
    };

    // Give the popup a buffer to complete opening
    setTimeout(announceToAllTabs, 100);
  }
}
