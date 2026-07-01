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
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherType } from "@bitwarden/common/vault/enums";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";
import { BiometricsCommands } from "@bitwarden/key-management";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import {
  closeUnlockPopout,
  openPasskeyResultPopout,
  openSsoAuthResultPopout,
  openTwoFactorAuthWebAuthnPopout,
} from "../auth/popup/utils/auth-popout-window";
import { PasskeyRelayService } from "../auth/services/passkey-relay.service";
import { LockedVaultPendingNotificationsData } from "../autofill/background/abstractions/notification.background";
import { AutofillService } from "../autofill/services/abstractions/autofill.service";
import { FORCE_TARGETING_RULES_UPDATE_COMMAND } from "../autofill/services/targeting-rules-data.service";
import {
  getPendingDefaultPasswordManagerApply,
  setPendingDefaultPasswordManagerApply,
} from "../autofill/utils/pending-default-password-manager.storage";
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
  private pendingPasskeyLoginEcdhSession: {
    privateKey: CryptoKey;
    expiresAt: number;
  } | null = null;

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
      case "getUrlAutofillTargetingRules": {
        return await this.main.domainSettingsService.getTargetingRulesForUrl(
          // Because content scripts are injected into all _frames_, we give precedence
          // to targeting rules matching by frame URI (`sender.url`) over tab URI, to avoid
          // selector collision with coincidentally-matching in-frame structures.
          sender.url ?? sender.tab?.url,
        );
      }
      case "authResult": {
        if (!(await this.isValidVaultReferrer(msg.referrer))) {
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

  private async handleSetBitwardenAsDefaultPasswordManager(
    permissions: chrome.permissions.Permissions | browser.permissions.Permissions,
  ) {
    if (!(permissions.permissions as string[] | undefined)?.includes("privacy")) {
      return;
    }

    if (!(await getPendingDefaultPasswordManagerApply())) {
      return;
    }

    try {
      await BrowserApi.updateDefaultBrowserAutofillSettings(false);
      await setPendingDefaultPasswordManagerApply(false);
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
      case "abandonAutofillPendingNotifications":
        this.lockedVaultPendingNotifications = [];
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
        if (!(await this.isValidVaultReferrer(msg.referrer))) {
          return;
        }

        await openTwoFactorAuthWebAuthnPopout(msg);
        break;
      }
      case "passkeyLoginResult":
      case "passkeyUnlockResult": {
        if (!(await this.isValidVaultReferrer(msg.referrer))) {
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
    }
  }

  /**
   * For messages that can originate from a vault host page or extension, validate referrer or external
   *
   * @param message
   * @returns true if message fails validation
   */
  private async executeMessageActionOrOpenPopup(
    message: {
      webExtSender: chrome.runtime.MessageSender;
    },
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

    const isValidVaultReferrer = await this.isValidVaultReferrer(
      Utils.getHostname(message?.webExtSender?.origin),
    );

    // When the referrer is not a known vault and the message is external, reject the message
    if (!isValidVaultReferrer && isExternalMessage(message)) {
      return;
    }

    await messageAction();
  }

  /**
   * Validates that a referrer hostname matches any of the available regions' and current environment web vault URLs.
   *
   * @param referrer - hostname from message source (should not include protocol or path)
   * @returns true if referrer matches any known vault hostname, false otherwise
   */
  private async isValidVaultReferrer(referrer: string | null | undefined): Promise<boolean> {
    if (!referrer) {
      return false;
    }

    const environment = await firstValueFrom(this.environmentService.environment$);

    const regions = this.environmentService.availableRegions();
    const regionVaultUrls = regions.map((r) => r.urls.webVault ?? r.urls.base);
    const environmentWebVaultUrl = environment.getWebVaultUrl();
    const messageIsFromKnownVault = [...regionVaultUrls, environmentWebVaultUrl].some(
      (webVaultUrl) => Utils.getHostname(webVaultUrl) === referrer,
    );

    return messageIsFromKnownVault;
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
          await this.browserInitialInstallService.displayWelcomePage();

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
