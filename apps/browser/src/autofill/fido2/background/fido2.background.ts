// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, startWith, Subscription } from "rxjs";
import { pairwise } from "rxjs/operators";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { Fido2ActiveRequestManager } from "@bitwarden/common/platform/abstractions/fido2/fido2-active-request-manager.abstraction";
import {
  AssertCredentialParams,
  AssertCredentialResult,
  CreateCredentialParams,
  CreateCredentialResult,
  Fido2ClientService,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-client.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";

import { BrowserApi } from "../../../platform/browser/browser-api";
import { ScriptInjectorService } from "../../../platform/services/abstractions/script-injector.service";
import { AbortManager } from "../../../vault/background/abort-manager";
import { Fido2ContentScript, Fido2ContentScriptId } from "../enums/fido2-content-script.enum";
import { Fido2PortName } from "../enums/fido2-port-name.enum";
import { BrowserFido2ParentWindowReference } from "../services/browser-fido2-user-interface.service";

import {
  Fido2BackgroundExtensionMessageHandlers,
  Fido2Background as Fido2BackgroundInterface,
  Fido2ExtensionMessage,
  SharedFido2ScriptInjectionDetails,
  SharedFido2ScriptRegistrationOptions,
} from "./abstractions/fido2.background";

export class Fido2Background implements Fido2BackgroundInterface {
  private currentAuthStatus$: Subscription;
  private abortManager = new AbortManager();
  private fido2ContentScriptPortsSet = new Set<chrome.runtime.Port>();
  private registeredContentScripts: browser.contentScripts.RegisteredContentScript;
  private readonly sharedInjectionDetails: SharedFido2ScriptInjectionDetails = {
    runAt: "document_start",
  };
  private readonly sharedRegistrationOptions: SharedFido2ScriptRegistrationOptions = {
    matches: ["https://*/*", "http://localhost/*"],
    excludeMatches: ["https://*/*.xml*"],
    allFrames: true,
    ...this.sharedInjectionDetails,
  };
  private readonly extensionMessageHandlers: Fido2BackgroundExtensionMessageHandlers = {
    fido2AbortRequest: ({ message }) => this.abortRequest(message),
    fido2RegisterCredentialRequest: ({ message, sender }) =>
      this.registerCredentialRequest(message, sender),
    fido2GetCredentialRequest: ({ message, sender }) => this.getCredentialRequest(message, sender),
  };

  constructor(
    private logService: LogService,
    private fido2ActiveRequestManager: Fido2ActiveRequestManager,
    private fido2ClientService: Fido2ClientService<BrowserFido2ParentWindowReference>,
    private vaultSettingsService: VaultSettingsService,
    private scriptInjectorService: ScriptInjectorService,
    private authService: AuthService,
  ) {}

  /**
   * Initializes the FIDO2 background service. Sets up the extension message
   * and port listeners. Subscribes to the enablePasskeys$ observable to
   * handle passkey enable/disable events.
   */
  init() {
    BrowserApi.messageListener("fido2.background", this.handleExtensionMessage);
    BrowserApi.addListener(chrome.runtime.onConnect, this.handleInjectedScriptPortConnection);
    this.vaultSettingsService.enablePasskeys$
      .pipe(startWith(undefined), pairwise())
      .subscribe(([previous, current]) => this.handleEnablePasskeysUpdate(previous, current));
    this.currentAuthStatus$ = this.authService.activeAccountStatus$
      .pipe(startWith(undefined), pairwise())
      .subscribe(([_previous, current]) => this.handleAuthStatusUpdate(current));
  }

  /**
   * Handles initializing the FIDO2 content scripts based on the current
   * authentication status. We only want to inject the FIDO2 content scripts
   * if the user is logged in.
   *
   * @param authStatus - The current authentication status.
   */
  private async handleAuthStatusUpdate(authStatus: AuthenticationStatus) {
    if (authStatus === AuthenticationStatus.LoggedOut) {
      return;
    }

    const enablePasskeys = await this.isPasskeySettingEnabled();
    await this.handleEnablePasskeysUpdate(enablePasskeys, enablePasskeys);
    this.currentAuthStatus$.unsubscribe();
  }

  /**
   * Injects the FIDO2 content and page script into all existing browser tabs.
   */
  private async injectFido2ContentScriptsInAllTabs() {
    const tabs = await BrowserApi.tabsQuery({});

    for (let index = 0; index < tabs.length; index++) {
      const tab = tabs[index];

      if (tab.url?.startsWith("https")) {
        void this.injectFido2ContentScripts(tab);
      }
    }
  }

  /**
   * Gets the user's authentication status from the auth service.
   */
  private async getAuthStatus() {
    return await firstValueFrom(this.authService.activeAccountStatus$);
  }

  /**
   * Handles reacting to the enablePasskeys setting being updated. If the setting
   * is enabled, the FIDO2 content scripts are injected into all tabs. If the setting
   * is disabled, the FIDO2 content scripts will be from all tabs. This logic will
   * not trigger until after the first setting update.
   *
   * @param previousEnablePasskeysSetting - The previous value of the enablePasskeys setting.
   * @param enablePasskeys - The new value of the enablePasskeys setting.
   */
  private async handleEnablePasskeysUpdate(
    previousEnablePasskeysSetting: boolean,
    enablePasskeys: boolean,
  ) {
    if ((await this.getAuthStatus()) === AuthenticationStatus.LoggedOut) {
      return;
    }

    if (previousEnablePasskeysSetting === undefined) {
      return;
    }

    this.fido2ActiveRequestManager.removeAllActiveRequests();
    await this.updateContentScriptRegistration();

    this.destroyLoadedFido2ContentScripts();
    if (enablePasskeys) {
      void this.injectFido2ContentScriptsInAllTabs();
    }
  }

  /**
   * Updates the registration status of static FIDO2 content
   * scripts based on the enablePasskeys setting.
   */
  private async updateContentScriptRegistration() {
    if (BrowserApi.isManifestVersion(2)) {
      await this.updateMv2ContentScriptsRegistration();

      return;
    }

    await this.updateMv3ContentScriptsRegistration();
  }

  /**
   * Updates the registration status of static FIDO2 content
   * scripts based on the enablePasskeys setting for manifest v2.
   */
  private async updateMv2ContentScriptsRegistration() {
    if (!(await this.isPasskeySettingEnabled())) {
      await this.registeredContentScripts?.unregister();

      return;
    }

    this.registeredContentScripts = await BrowserApi.registerContentScriptsMv2({
      js: [
        { file: await this.getFido2PageScriptAppendFileName() },
        { file: Fido2ContentScript.ContentScript },
      ],
      ...this.sharedRegistrationOptions,
    });
  }

  /**
   * Updates the registration status of static FIDO2 content
   * scripts based on the enablePasskeys setting for manifest v3.
   */
  private async updateMv3ContentScriptsRegistration() {
    if (await this.isPasskeySettingEnabled()) {
      void BrowserApi.registerContentScriptsMv3([
        {
          id: Fido2ContentScriptId.PageScript,
          js: [Fido2ContentScript.PageScript],
          world: "MAIN",
          ...this.sharedRegistrationOptions,
        },
        {
          id: Fido2ContentScriptId.ContentScript,
          js: [Fido2ContentScript.ContentScript],
          ...this.sharedRegistrationOptions,
        },
      ]);

      return;
    }

    void BrowserApi.unregisterContentScriptsMv3({
      ids: [Fido2ContentScriptId.PageScript, Fido2ContentScriptId.ContentScript],
    });
  }

  /**
   * Injects the FIDO2 content and page script into the current tab.
   *
   * @param tab - The current tab to inject the scripts into.
   */
  private async injectFido2ContentScripts(tab: chrome.tabs.Tab): Promise<void> {
    void this.scriptInjectorService.inject({
      tabId: tab.id,
      injectDetails: { frame: "all_frames", ...this.sharedInjectionDetails },
      mv2Details: { file: await this.getFido2PageScriptAppendFileName() },
      mv3Details: { file: Fido2ContentScript.PageScript, world: "MAIN" },
    });

    void this.scriptInjectorService.inject({
      tabId: tab.id,
      injectDetails: {
        file: Fido2ContentScript.ContentScript,
        frame: "all_frames",
        ...this.sharedInjectionDetails,
      },
    });
  }

  /**
   * Iterates over the set of injected FIDO2 content script ports
   * and disconnects them, destroying the content scripts.
   */
  private destroyLoadedFido2ContentScripts() {
    this.fido2ContentScriptPortsSet.forEach((port) => {
      port.disconnect();
      this.fido2ContentScriptPortsSet.delete(port);
    });
  }

  /**
   * Aborts the FIDO2 request with the provided requestId.
   *
   * @param message - The FIDO2 extension message containing the requestId to abort.
   */
  private abortRequest(message: Fido2ExtensionMessage) {
    this.abortManager.abort(message.abortedRequestId);
  }

  /**
   * Registers a new FIDO2 credential with the provided request data.
   *
   * @param message - The FIDO2 extension message containing the request data.
   * @param sender - The sender of the message.
   */
  private async registerCredentialRequest(
    message: Fido2ExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ): Promise<CreateCredentialResult> {
    return await this.handleCredentialRequest<CreateCredentialResult>(
      message,
      sender.tab,
      this.fido2ClientService.createCredential.bind(this.fido2ClientService),
    );
  }

  /**
   * Gets a FIDO2 credential with the provided request data.
   *
   * @param message - The FIDO2 extension message containing the request data.
   * @param sender - The sender of the message.
   */
  private async getCredentialRequest(
    message: Fido2ExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ): Promise<AssertCredentialResult> {
    return await this.handleCredentialRequest<AssertCredentialResult>(
      message,
      sender.tab,
      this.fido2ClientService.assertCredential.bind(this.fido2ClientService),
    );
  }

  /**
   * Handles Fido2 credential requests by calling the provided callback with the
   * request data, tab, and abort controller. The callback is expected to return
   * a promise that resolves with the result of the credential request.
   *
   * @param requestId - The request ID associated with the request.
   * @param data - The request data to handle.
   * @param tab - The tab associated with the request.
   * @param callback - The callback to call with the request data, tab, and abort controller.
   */
  private handleCredentialRequest = async <T>(
    { requestId, data }: Fido2ExtensionMessage,
    tab: chrome.tabs.Tab,
    callback: (
      data: AssertCredentialParams | CreateCredentialParams,
      tab: chrome.tabs.Tab,
      abortController: AbortController,
    ) => Promise<T>,
  ) => {
    return await this.abortManager.runWithAbortController(requestId, async (abortController) => {
      try {
        return await callback(data, tab, abortController);
      } finally {
        await BrowserApi.focusTab(tab.id);
        await BrowserApi.focusWindow(tab.windowId);
      }
    });
  };

  /**
   * Checks if the enablePasskeys setting is enabled.
   */
  private async isPasskeySettingEnabled() {
    return await firstValueFrom(this.vaultSettingsService.enablePasskeys$);
  }

  /**
   * Handles the FIDO2 extension message by calling the
   * appropriate handler based on the message command.
   *
   * @param message - The FIDO2 extension message to handle.
   * @param sender - The sender of the message.
   * @param sendResponse - The function to call with the response.
   */
  private handleExtensionMessage = (
    message: Fido2ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ) => {
    const handler: CallableFunction | undefined = this.extensionMessageHandlers[message?.command];
    if (!handler) {
      return null;
    }

    const messageResponse = handler({ message, sender });
    if (typeof messageResponse === "undefined") {
      return null;
    }

    Promise.resolve(messageResponse)
      .then(
        (response) => sendResponse(response),
        (error) => sendResponse({ error: { ...error, message: error.message } }),
      )
      .catch(this.logService.error);

    return true;
  };

  /**
   * Handles the connection of a FIDO2 content script port by checking if the
   * FIDO2 feature is enabled for the sender's hostname and origin. If the feature
   * is not enabled, the port is disconnected.
   *
   * @param port - The port which is connecting
   */
  private handleInjectedScriptPortConnection = async (port: chrome.runtime.Port) => {
    if (port.name !== Fido2PortName.InjectedScript || !port.sender?.url) {
      return;
    }

    try {
      const { hostname, origin } = new URL(port.sender.url);
      if (!(await this.fido2ClientService.isFido2FeatureEnabled(hostname, origin))) {
        port.disconnect();
        return;
      }

      this.fido2ContentScriptPortsSet.add(port);
      port.onDisconnect.addListener(this.handleInjectScriptPortOnDisconnect);
    } catch (error) {
      this.logService.error(error);
      port.disconnect();
    }
  };

  /**
   * Handles the disconnection of a FIDO2 content script port
   * by removing it from the set of connected ports.
   *
   * @param port - The port which is disconnecting
   */
  private handleInjectScriptPortOnDisconnect = (port: chrome.runtime.Port) => {
    if (port.name !== Fido2PortName.InjectedScript) {
      return;
    }

    this.fido2ContentScriptPortsSet.delete(port);
  };

  /**
   * Gets the file name of the page-script used within mv2. Will return the
   * delayed append script if the associated feature flag is enabled.
   */
  private async getFido2PageScriptAppendFileName() {
    return Fido2ContentScript.PageScriptDelayAppend;
  }
}
