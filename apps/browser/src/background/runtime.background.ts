// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map, mergeMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutofillOverlayVisibility, ExtensionCommand } from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import {
  IntraprocessMessageSender,
  MessageListener,
  isExternalMessage,
} from "@bitwarden/common/platform/messaging";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherType } from "@bitwarden/common/vault/enums";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";
import { BiometricsCommands } from "@bitwarden/key-management";
import { LockService, LockSource } from "@bitwarden/unlock";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import {
  closeUnlockPopout,
  openPasskeyResultPopout,
  openSsoAuthResultPopout,
  openTwoFactorAuthWebAuthnPopout,
} from "../auth/popup/utils/auth-popout-window";
import { PasskeyRelayService } from "../auth/services/passkey-relay.service";
import {
  ADD_TO_LOCKED_VAULT_PENDING_NOTIFICATIONS,
  LockedVaultPendingNotificationsData,
  RETRY_SENDER,
  RETRY_WHEN_UNLOCK_COMPLETED,
} from "../autofill/background/abstractions/notification.background";
import { AutofillOrchestrator } from "../autofill/background/autofill-orchestrator";
import { isDefaultPasswordManagerPromptFeatureEnabled } from "../autofill/default-password-manager-prompt-feature.util";
import { DefaultPasswordManagerPromptStateAccessor } from "../autofill/default-password-manager-prompt-state.accessor";
import { completePendingDefaultPasswordManagerApply } from "../autofill/default-password-manager-session.util";
import { AutofillMessageCommand } from "../autofill/enums/autofill-message.enums";
import { AutofillLifecycleService } from "../autofill/services/abstractions/autofill-lifecycle.service";
import { AutofillService } from "../autofill/services/abstractions/autofill.service";
import { FORCE_TARGETING_RULES_UPDATE_COMMAND } from "../autofill/services/targeting-rules-data.service";
import { BrowserApi } from "../platform/browser/browser-api";
import BrowserPopupUtils from "../platform/browser/browser-popup-utils";
import { BrowserEnvironmentService } from "../platform/services/browser-environment.service";
import BrowserInitialInstallService from "../platform/services/browser-initial-install.service";
import { BrowserPlatformUtilsService } from "../platform/services/platform-utils/browser-platform-utils.service";
import { isValidVaultReferrer } from "../platform/utils/valid-vault-referrer";
import { getWebExtSender } from "../platform/utils/web-ext-sender";

import MainBackground from "./main.background";

export default class RuntimeBackground {
  private autofillTimeout: any;
  private pageDetailsToAutoFill: any[] = [];
  private onInstalledReason: string = null;
  private lockedVaultPendingNotifications: LockedVaultPendingNotificationsData[] = [];
  private pendingPasskeyLoginEcdhSession: {
    privateKey: CryptoKey;
    expiresAt: number;
  } | null = null;

  constructor(
    private main: MainBackground,
    private autofillService: AutofillService,
    private platformUtilsService: BrowserPlatformUtilsService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private environmentService: BrowserEnvironmentService,
    private messagingService: MessagingService,
    private logService: LogService,
    private configService: ConfigService,
    private messageListener: MessageListener,
    private accountService: AccountService,
    private readonly lockService: LockService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private browserInitialInstallService: BrowserInitialInstallService,
    private autofillLifecycleService: AutofillLifecycleService,
    private defaultPasswordManagerPromptStateAccessor: DefaultPasswordManagerPromptStateAccessor,
    private autofillOrchestrator: AutofillOrchestrator,
    private intraprocessMessageSender: IntraprocessMessageSender,
    private passkeyRelayService: PasskeyRelayService,
  ) {
    // onInstalled listener must be wired up before anything else, so we do it in the ctor
    chrome.runtime.onInstalled.addListener((details: any) => {
      this.onInstalledReason = details.reason;
    });

    const onPrivacyPermissionAdded = (
      permissions: chrome.permissions.Permissions | browser.permissions.Permissions,
    ) => {
      void this.handleSetBitwardenAsDefaultPasswordManager(permissions);
    };

    if (BrowserApi.isWebExtensionsApi && browser?.permissions?.onAdded) {
      browser.permissions.onAdded.addListener(onPrivacyPermissionAdded);
    } else if (chrome?.permissions?.onAdded) {
      chrome.permissions.onAdded.addListener(onPrivacyPermissionAdded);
    }
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
        "getUrlAutofillTargetingRules",
        "getBitwardenAutofillAttributeSettings",
        "initiatePasskeyRelay",
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
      case AutofillMessageCommand.pageTransitionDetected:
        // A page-lifecycle monitor reports a transition as a fact. The service
        // buffers it against monitoring state and `AutofillOrchestrator` decides whether
        // it warrants a collection.
        this.autofillLifecycleService.reportPageTransition(sender.tab, sender.frameId, sender.url);
        break;
      case "collectPageDetailsResponse":
        switch (msg.sender) {
          case ExtensionCommand.AutofillCommand:
            this.autofillOrchestrator.autofillActiveTabFromCommand({
              frameId: sender.frameId,
              tab: msg.tab,
              details: msg.details,
            });
            break;
          case ExtensionCommand.AutofillCard:
            this.autofillOrchestrator.autofillActiveTabForCipherType(
              {
                frameId: sender.frameId,
                tab: msg.tab,
                details: msg.details,
              },
              CipherType.Card,
            );
            break;
          case ExtensionCommand.AutofillIdentity:
            this.autofillOrchestrator.autofillActiveTabForCipherType(
              {
                frameId: sender.frameId,
                tab: msg.tab,
                details: msg.details,
              },
              CipherType.Identity,
            );
            break;
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
      case "getUrlAutofillTargetingRules": {
        const senderURL = await this.resolveSenderFrameUrl(sender);
        const targetingRulesForUrl =
          await this.main.domainSettingsService.getTargetingRulesForUrl(senderURL);

        return targetingRulesForUrl;
      }
      case "getBitwardenAutofillAttributeSettings": {
        const [honorBitwardenIgnoreAttribute, honorBitwardenAutofillAttribute] = await Promise.all([
          firstValueFrom(this.autofillSettingsService.honorBitwardenIgnoreAttribute$),
          firstValueFrom(this.autofillSettingsService.honorBitwardenAutofillAttribute$),
        ]);

        return { honorBitwardenIgnoreAttribute, honorBitwardenAutofillAttribute };
      }
      case "authResult": {
        if (!(await isValidVaultReferrer(this.environmentService, msg.referrer))) {
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

        if (sender.tab?.id) {
          await BrowserApi.closeTab(sender.tab.id).catch((error) => {
            this.logService.error("Unable to close SSO tab", error);
          });
        }
        break;
      }
      case "initiatePasskeyRelay": {
        return await this.initiatePasskeyRelay();
      }
    }
  }

  /** Resolves the URL currently loaded in the frame a message came from. */
  private async resolveSenderFrameUrl(
    sender: chrome.runtime.MessageSender,
  ): Promise<string | undefined> {
    const tabId = sender.tab?.id;
    const frameId = sender.frameId;

    if (tabId != null && frameId != null) {
      // `frame.url` takes precedence over `tab.url` to minimize selector
      // collisions between frames with similar in-frame markup. `frame.url`
      // takes precedence over `sender.url` because the sender's value is pinned
      // to the frame URI when the port was opened.
      const frameUrl = await BrowserApi.getFrameDetails({ tabId, frameId })
        .then((frame) => frame?.url)
        .catch((): undefined => undefined);

      if (frameUrl) {
        return frameUrl;
      }
    }

    if (frameId === 0 && sender.tab?.url) {
      return sender.tab.url;
    }

    return sender.url ?? sender.tab?.url;
  }

  private async handleSetBitwardenAsDefaultPasswordManager(
    permissions: chrome.permissions.Permissions | browser.permissions.Permissions,
  ) {
    if (!(permissions.permissions as string[] | undefined)?.includes("privacy")) {
      return;
    }

    if (!(await isDefaultPasswordManagerPromptFeatureEnabled(this.configService))) {
      return;
    }

    try {
      await completePendingDefaultPasswordManagerApply();
    } catch (error) {
      this.logService.error(error);
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

        if (item) {
          const senderTab = item.commandToRetry?.[RETRY_SENDER]?.tab;
          // No tab means nothing to focus
          if (senderTab) {
            await BrowserApi.focusWindow(senderTab.windowId);
            await BrowserApi.focusTab(senderTab.id);
          }

          // Dispatched intraprocess, so the retained command reaches the background consumers
          // without being serialized out to the sender tab and read back.
          //
          // The intraprocess subject does not replay, so every consumer must already be
          // subscribed when this runs. The `awaits` on the `loggedIn` command ensure these
          // subscriptions are active when `RETRY_WHEN_UNLOCK_COMPLETED` is sent.
          //
          // FIXME: That precondition is non-local — nothing here enforces the bootstrap order it
          // depends on. Awaiting `initOverlayAndTabsBackground()` unconditionally in this branch
          // would make the construction unconditional rather than conventional, but it would
          // also build the overlay on unlock in states where today it stays unbuilt (the call
          // early-returns when logged out), so it was left out of a security-only change.
          this.intraprocessMessageSender.send(RETRY_WHEN_UNLOCK_COMPLETED, { data: item });
        }

        // @TODO The underlying cause exists within `cipherService.getAllDecrypted` via
        // `getAllDecryptedForUrl` and is anticipated to be refactored.
        await this.main.refreshMenu(false);

        await this.autofillService.setAutoFillOnPageLoadOrgPolicy();
        break;
      }
      case ADD_TO_LOCKED_VAULT_PENDING_NOTIFICATIONS.command:
        // The payload names the tab that will receive the retried autofill, so it is only
        // honoured when the background authored it. A copy that arrived over
        // `chrome.runtime.onMessage` is tagged external at ingest and dropped here.
        if (!isExternalMessage(msg)) {
          this.lockedVaultPendingNotifications.push(msg.data);
        }
        break;
      case "abandonAutofillPendingNotifications":
        // Deliberately ungated, unlike the enqueue above: discarding the queue grants nothing,
        // so the worst an external copy can do is drop a retry the user would have to redo.
        this.lockedVaultPendingNotifications = [];
        break;
      case "lockVault":
        await this.lockService.lock(msg.userId, LockSource.Manual);
        break;
      case "lockAll":
        {
          await this.lockService.lockAll(msg.source);
          this.messagingService.send("lockAllFinished", { requestId: msg.requestId });
        }
        break;
      case "lockUser":
        {
          await this.lockService.lock(msg.userId, msg.source);
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
      case FORCE_TARGETING_RULES_UPDATE_COMMAND:
        this.main.targetingRulesDataService.forceUpdate();
        break;
      case "openPopup":
        await this.executeMessageActionOrOpenPopup(msg, this.openPopup.bind(this));
        break;
      case VaultMessages.OpenAtRiskPasswords: {
        await this.executeMessageActionOrOpenPopup(
          msg,
          this.main.openAtRisksPasswordsPage.bind(this),
        );
        this.announcePopupOpen();
        break;
      }
      case VaultMessages.OpenBrowserExtensionToUrl: {
        await this.executeMessageActionOrOpenPopup(
          msg,
          this.main.openTheExtensionToPage.bind(this, msg.url),
        );
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
      case "webAuthnResult": {
        if (!(await isValidVaultReferrer(this.environmentService, msg.referrer))) {
          return;
        }

        await openTwoFactorAuthWebAuthnPopout(msg);
        break;
      }
      case "passkeyLoginResult":
      case "passkeyUnlockResult": {
        if (!(await isValidVaultReferrer(this.environmentService, msg.referrer))) {
          return;
        }

        const type = msg.command === "passkeyLoginResult" ? "login" : "unlock";
        await this.handlePasskeyResult({ ...msg, type });
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
      case "reloadExtension": {
        // Close any open popups first so the runtime reload doesn't strand them with an
        // invalidated context. The popup closes itself upon receiving this message; poll to
        // confirm before reloading. Unlike process reload (which is skipped while the vault is
        // unlocked), this reload must always run — e.g. to register the native messaging host
        // after the nativeMessaging permission is granted from the unlocked settings page.
        await BrowserPopupUtils.waitForAllPopupsClose();
        BrowserApi.reloadExtension();
        break;
      }
    }
  }

  /**
   * For messages that can originate from a vault host page or extension, validate referrer or external
   *
   * @param message
   * @returns true if message fails validation
   */
  private async executeMessageActionOrOpenPopup(
    message: Record<PropertyKey, unknown>,
    messageAction: () => Promise<void>,
  ): Promise<boolean> {
    const hasAccounts = await firstValueFrom(
      this.accountService.accounts$.pipe(map((a) => Object.keys(a).length > 0)),
    );

    // When there are no accounts associated with the extension, only allow opening the popup
    if (!hasAccounts) {
      await this.openPopup();
      return;
    }

    const referrerIsKnownVault = await isValidVaultReferrer(
      this.environmentService,
      Utils.getHostname(getWebExtSender(message)?.origin),
    );

    // When the referrer is not a known vault and the message is external, reject the message
    if (!referrerIsKnownVault && isExternalMessage(message)) {
      return;
    }

    await messageAction();
  }

  private async autofillPage(tabToAutoFill: chrome.tabs.Tab) {
    const result = await this.autofillService.doAutoFill({
      tab: tabToAutoFill,
      cipher: this.main.loginToAutoFill,
      pageDetails: this.pageDetailsToAutoFill,
      fillNewPassword: true,
      allowTotpAutofill: true,
    });

    if (result.didAutofill && result.totp != null) {
      this.platformUtilsService.copyToClipboard(result.totp);
    }

    // reset
    this.main.loginToAutoFill = null;
    this.pageDetailsToAutoFill = [];
  }

  private async checkOnInstalled() {
    setTimeout(async () => {
      void this.autofillService.loadAutofillScriptsOnInstall();

      if (this.onInstalledReason != null) {
        if (this.onInstalledReason === "install") {
          if (await isDefaultPasswordManagerPromptFeatureEnabled(this.configService)) {
            await this.defaultPasswordManagerPromptStateAccessor.markFreshInstallEligible();
          }

          if (!(await firstValueFrom(this.browserInitialInstallService.extensionInstalled$))) {
            await this.browserInitialInstallService.displayWelcomePage();

            await this.autofillSettingsService.setInlineMenuVisibility(
              AutofillOverlayVisibility.OnFieldFocus,
            );

            if (await this.environmentService.hasManagedEnvironment()) {
              await this.environmentService.setUrlsToManagedEnvironment();
            }
            await this.browserInitialInstallService.setExtensionInstalled(true);
          }
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
      const tabs = await this.getBwTabs();
      for (const tab of tabs) {
        await BrowserApi.executeScriptInTab(tab.id, {
          file: "content/send-popup-open-message.js",
          runAt: "document_end",
        });
      }
    };

    // Poll every 200ms (up to 1s) until the popup is open, to handle browser timing differences
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const isOpen = await this.platformUtilsService.isPopupOpen();
      if (isOpen) {
        clearInterval(interval);
        await announceToAllTabs();
      } else if (attempts >= 5) {
        clearInterval(interval);
      }
    }, 200);
  }

  /**
   * Handles passkey result messages (login or unlock) from the connector page.
   * Decrypts the PRF output using ECDH and opens the appropriate result popout.
   */
  private async handlePasskeyResult(msg: {
    type: "login" | "unlock";
    token?: string;
    assertionData?: string;
    credentialId?: string;
    encryptedPrfOutput?: { ciphertext: string; iv: string } | null;
    connectorPublicKey?: string | null;
    referrer: string;
  }): Promise<void> {
    const login = msg.type === "login";
    const logPrefix = login ? "[PasskeyLogin]" : "[PasskeyUnlock]";

    // Use unified popout function
    const popoutType = login ? "login" : "unlock";

    try {
      this.logService.info(`${logPrefix} handlePasskeyResult called`);

      // Check if there's a pending ECDH session and it's not expired
      if (
        !this.pendingPasskeyLoginEcdhSession ||
        Date.now() > this.pendingPasskeyLoginEcdhSession.expiresAt
      ) {
        this.logService.error(`${logPrefix} No pending passkey session or session expired`);
        return;
      }

      this.logService.info(`${logPrefix} ECDH session valid, processing result...`);

      let prfOutput: ArrayBuffer | null = null;

      // Decrypt PRF output if present
      if (msg.encryptedPrfOutput && msg.connectorPublicKey) {
        this.logService.info(`${logPrefix} Decrypting PRF output...`);
        prfOutput = await this.decryptPrfOutput(
          msg.encryptedPrfOutput.ciphertext,
          msg.encryptedPrfOutput.iv,
          msg.connectorPublicKey,
        );
        this.logService.info(`${logPrefix} PRF output decrypted successfully`);
      } else {
        this.logService.info(`${logPrefix} No encrypted PRF output to decrypt`);
      }

      this.logService.info(`${logPrefix} Storing result in relay service...`);

      // Store the result in the relay service for the popout to consume
      if (login) {
        await this.passkeyRelayService.storeResult({
          type: "login",
          token: msg.token!,
          assertionData: msg.assertionData!,
          prfOutput,
        });
      } else {
        await this.passkeyRelayService.storeResult({
          type: "unlock",
          credentialId: msg.credentialId!,
          prfOutput: prfOutput as ArrayBuffer, // unlock always requires PRF output
        });
      }

      this.logService.info(`${logPrefix} Opening result popout...`);
      // Open the result popout
      await openPasskeyResultPopout(popoutType);
      this.logService.info(`${logPrefix} Result popout opened successfully`);
    } catch (error) {
      this.logService.error(`${logPrefix} Error handling passkey result`, error);
    } finally {
      // Always discard the ephemeral ECDH private key, even on failure. CryptoKey objects
      // cannot be explicitly zeroed in JavaScript; removing the only reference is the best
      // available mitigation.
      this.pendingPasskeyLoginEcdhSession = null;
    }
  }

  /**
   * Decrypts the PRF output using ECDH key exchange.
   */
  private async decryptPrfOutput(
    ciphertextB64: string,
    ivB64: string,
    connectorPublicKeyB64: string,
  ): Promise<ArrayBuffer> {
    if (!this.pendingPasskeyLoginEcdhSession) {
      throw new Error("No pending ECDH session");
    }

    // Convert base64url to ArrayBuffer
    const ciphertext = this.base64urlToBuffer(ciphertextB64);
    const iv = this.base64urlToBuffer(ivB64);
    const connectorPublicKeyBuffer = this.base64urlToBuffer(connectorPublicKeyB64);

    // Import connector's public key
    const connectorPublicKey = await crypto.subtle.importKey(
      "raw",
      connectorPublicKeyBuffer,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      false,
      [],
    );

    // Derive shared secret using ECDH
    const sharedSecret = await crypto.subtle.deriveBits(
      {
        name: "ECDH",
        public: connectorPublicKey,
      },
      this.pendingPasskeyLoginEcdhSession.privateKey,
      256,
    );

    // Derive AES-GCM key from shared secret using HKDF
    const aesKey = await this.deriveAesKeyFromSharedSecret(sharedSecret);

    // Decrypt the PRF output
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: new Uint8Array(iv),
      },
      aesKey,
      ciphertext,
    );

    return decrypted;
  }

  /**
   * Derive AES-GCM key from shared secret using HKDF.
   */
  private async deriveAesKeyFromSharedSecret(sharedSecret: ArrayBuffer): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, [
      "deriveKey",
    ]);

    return await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        salt: new Uint8Array(0), // Empty salt - the shared secret is already random
        info: new TextEncoder().encode("passkey-login-prf"),
        hash: "SHA-256",
      },
      keyMaterial,
      {
        name: "AES-GCM",
        length: 256,
      },
      false,
      ["decrypt"],
    );
  }

  /**
   * Convert base64url string to ArrayBuffer.
   */
  private base64urlToBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const padded = base64 + padding;
    const binary = atob(padded);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer.buffer;
  }

  /**
   * Initiates a passkey relay session by generating an ephemeral ECDH key pair.
   * Called when the user clicks "Log in with passkey" or "Unlock with passkey" on Firefox.
   *
   * @returns The base64url-encoded public key to pass to the connector page
   */
  async initiatePasskeyRelay(): Promise<string> {
    // Discard any previous session private key to avoid retaining stale key material.
    this.pendingPasskeyLoginEcdhSession = null;

    // Generate ephemeral ECDH key pair (P-256)
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true, // extractable - we need to export the public key
      ["deriveBits"],
    );

    // Store the private key with 5-minute expiry
    this.pendingPasskeyLoginEcdhSession = {
      privateKey: keyPair.privateKey,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    };

    // Export and return the public key
    const publicKeyBuffer = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    return this.bufferToBase64url(publicKeyBuffer);
  }

  /**
   * Convert ArrayBuffer to base64url string.
   */
  private bufferToBase64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
}
