import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { Fido2ActiveRequestManager } from "@bitwarden/common/platform/abstractions/fido2/fido2-active-request-manager.abstraction";
import {
  AssertCredentialParams,
  CreateCredentialParams,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-client.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Fido2ClientService } from "@bitwarden/common/platform/services/fido2/fido2-client.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";

import { createPortSpyMock } from "../../../autofill/spec/autofill-mocks";
import {
  flushPromises,
  sendMockExtensionMessage,
  triggerPortOnDisconnectEvent,
  triggerRuntimeOnConnectEvent,
} from "../../../autofill/spec/testing-utils";
import { BrowserApi } from "../../../platform/browser/browser-api";
import { BrowserScriptInjectorService } from "../../../platform/services/browser-script-injector.service";
import { AbortManager } from "../../../vault/background/abort-manager";
import { Fido2ContentScript, Fido2ContentScriptId } from "../enums/fido2-content-script.enum";
import { Fido2PortName } from "../enums/fido2-port-name.enum";
import { BrowserFido2ParentWindowReference } from "../services/browser-fido2-user-interface.service";

import { Fido2ExtensionMessage } from "./abstractions/fido2.background";
import { Fido2Background } from "./fido2.background";

const sharedExecuteScriptOptions = { runAt: "document_start" };
const sharedScriptInjectionDetails = { frame: "all_frames", ...sharedExecuteScriptOptions };
const contentScriptDetails = {
  file: Fido2ContentScript.ContentScript,
  ...sharedScriptInjectionDetails,
};
const sharedRegistrationOptions = {
  matches: ["https://*/*", "http://localhost/*"],
  excludeMatches: ["https://*/*.xml*"],
  allFrames: true,
  ...sharedExecuteScriptOptions,
};

describe("Fido2Background", () => {
  const tabsQuerySpy: jest.SpyInstance = jest.spyOn(BrowserApi, "tabsQuery");
  const isManifestVersionSpy: jest.SpyInstance = jest.spyOn(BrowserApi, "isManifestVersion");
  const focusTabSpy: jest.SpyInstance = jest.spyOn(BrowserApi, "focusTab").mockResolvedValue();
  const focusWindowSpy: jest.SpyInstance = jest
    .spyOn(BrowserApi, "focusWindow")
    .mockResolvedValue();
  let abortManagerMock!: MockProxy<AbortManager>;
  let abortController!: MockProxy<AbortController>;
  let registeredContentScripsMock!: MockProxy<browser.contentScripts.RegisteredContentScript>;
  let tabMock!: MockProxy<chrome.tabs.Tab>;
  let senderMock!: MockProxy<chrome.runtime.MessageSender>;
  let logService!: MockProxy<LogService>;
  let fido2ActiveRequestManager: MockProxy<Fido2ActiveRequestManager>;
  let fido2ClientService!: MockProxy<Fido2ClientService<BrowserFido2ParentWindowReference>>;
  let vaultSettingsService!: MockProxy<VaultSettingsService>;
  let scriptInjectorServiceMock!: MockProxy<BrowserScriptInjectorService>;
  let enablePasskeysMock$!: BehaviorSubject<boolean>;
  let activeAccountStatusMock$: BehaviorSubject<AuthenticationStatus>;
  let authServiceMock!: MockProxy<AuthService>;
  let fido2Background!: Fido2Background;

  beforeEach(() => {
    tabMock = mock<chrome.tabs.Tab>({
      id: 123,
      url: "https://example.com",
      windowId: 456,
    });
    senderMock = mock<chrome.runtime.MessageSender>({ id: "1", tab: tabMock });
    logService = mock<LogService>();
    fido2ClientService = mock<Fido2ClientService<BrowserFido2ParentWindowReference>>();
    vaultSettingsService = mock<VaultSettingsService>();
    abortManagerMock = mock<AbortManager>();
    abortController = mock<AbortController>();
    registeredContentScripsMock = mock<browser.contentScripts.RegisteredContentScript>();
    scriptInjectorServiceMock = mock<BrowserScriptInjectorService>();

    enablePasskeysMock$ = new BehaviorSubject(true);
    vaultSettingsService.enablePasskeys$ = enablePasskeysMock$;
    fido2ActiveRequestManager = mock<Fido2ActiveRequestManager>();
    fido2ClientService.isFido2FeatureEnabled.mockResolvedValue(true);
    activeAccountStatusMock$ = new BehaviorSubject(AuthenticationStatus.Unlocked);
    authServiceMock = mock<AuthService>();
    authServiceMock.activeAccountStatus$ = activeAccountStatusMock$;
    fido2Background = new Fido2Background(
      logService,
      fido2ActiveRequestManager,
      fido2ClientService,
      vaultSettingsService,
      scriptInjectorServiceMock,
      authServiceMock,
    );
    fido2Background["abortManager"] = abortManagerMock;
    abortManagerMock.runWithAbortController.mockImplementation((_requestId, runner) =>
      runner(abortController),
    );
    isManifestVersionSpy.mockImplementation((manifestVersion) => manifestVersion === 2);
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe("handleAuthStatusUpdate", () => {
    let updateContentScriptRegistrationSpy: jest.SpyInstance;

    beforeEach(() => {
      updateContentScriptRegistrationSpy = jest
        .spyOn(fido2Background as any, "updateContentScriptRegistration")
        .mockImplementation();
    });

    it("skips triggering the passkeys settings update if the user is logged out", async () => {
      activeAccountStatusMock$.next(AuthenticationStatus.LoggedOut);

      fido2Background.init();
      await flushPromises();

      expect(updateContentScriptRegistrationSpy).not.toHaveBeenCalled();
    });

    it("triggers the passkeys setting update if the user is logged in", async () => {
      activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);

      fido2Background.init();
      await flushPromises();

      expect(updateContentScriptRegistrationSpy).toHaveBeenCalled();
    });
  });

  describe("handleEnablePasskeysUpdate", () => {
    let portMock!: MockProxy<chrome.runtime.Port>;

    beforeEach(() => {
      jest.spyOn(fido2Background as any, "handleAuthStatusUpdate").mockImplementation();
      fido2Background.init();
      jest.spyOn(BrowserApi, "registerContentScriptsMv2");
      jest.spyOn(BrowserApi, "registerContentScriptsMv3");
      jest.spyOn(BrowserApi, "unregisterContentScriptsMv3");
      portMock = createPortSpyMock(Fido2PortName.InjectedScript);
      triggerRuntimeOnConnectEvent(portMock);
      triggerRuntimeOnConnectEvent(createPortSpyMock("some-other-port"));

      tabsQuerySpy.mockResolvedValue([tabMock]);
    });

    it("skips handling the passkey update if the user is logged out", async () => {
      activeAccountStatusMock$.next(AuthenticationStatus.LoggedOut);

      enablePasskeysMock$.next(true);

      expect(portMock.disconnect).not.toHaveBeenCalled();
      expect(scriptInjectorServiceMock.inject).not.toHaveBeenCalled();
    });

    it("does not destroy and re-inject the content scripts when triggering `handleEnablePasskeysUpdate` with an undefined currentEnablePasskeysSetting property", async () => {
      await flushPromises();

      expect(portMock.disconnect).not.toHaveBeenCalled();
      expect(scriptInjectorServiceMock.inject).not.toHaveBeenCalled();
    });

    it("destroys the content scripts but skips re-injecting them when the enablePasskeys setting is set to `false`", async () => {
      enablePasskeysMock$.next(false);
      await flushPromises();

      expect(portMock.disconnect).toHaveBeenCalled();
      expect(scriptInjectorServiceMock.inject).not.toHaveBeenCalled();
    });

    it("destroys and re-injects the content scripts when the enablePasskeys setting is set to `true`", async () => {
      enablePasskeysMock$.next(true);
      await flushPromises();

      expect(portMock.disconnect).toHaveBeenCalled();
      expect(scriptInjectorServiceMock.inject).toHaveBeenCalledWith({
        tabId: tabMock.id,
        injectDetails: sharedScriptInjectionDetails,
        mv2Details: { file: Fido2ContentScript.PageScriptDelayAppend },
        mv3Details: { file: Fido2ContentScript.PageScript, world: "MAIN" },
      });
      expect(scriptInjectorServiceMock.inject).toHaveBeenCalledWith({
        tabId: tabMock.id,
        injectDetails: contentScriptDetails,
      });
    });

    describe("given manifest v2", () => {
      it("registers the page-script-append-mv2.js and content-script.js content scripts when the enablePasskeys setting is set to `true`", async () => {
        isManifestVersionSpy.mockImplementation((manifestVersion) => manifestVersion === 2);

        enablePasskeysMock$.next(true);
        await flushPromises();

        expect(BrowserApi.registerContentScriptsMv2).toHaveBeenCalledWith({
          js: [
            { file: Fido2ContentScript.PageScriptDelayAppend },
            { file: Fido2ContentScript.ContentScript },
          ],
          world: "MAIN",
          ...sharedRegistrationOptions,
        });
      });

      it("unregisters any existing registered content scripts when the enablePasskeys setting is set to `false`", async () => {
        isManifestVersionSpy.mockImplementation((manifestVersion) => manifestVersion === 2);
        fido2Background["registeredContentScripts"] = registeredContentScripsMock;

        enablePasskeysMock$.next(false);
        await flushPromises();

        expect(registeredContentScripsMock.unregister).toHaveBeenCalled();
        expect(BrowserApi.registerContentScriptsMv2).not.toHaveBeenCalledTimes(2);
      });
    });

    describe("given manifest v3", () => {
      it("registers the page-script.js and content-script.js content scripts when the enablePasskeys setting is set to `true`", async () => {
        isManifestVersionSpy.mockImplementation((manifestVersion) => manifestVersion === 3);

        enablePasskeysMock$.next(true);
        await flushPromises();

        expect(BrowserApi.registerContentScriptsMv3).toHaveBeenCalledWith([
          {
            id: Fido2ContentScriptId.PageScript,
            js: [Fido2ContentScript.PageScript],
            world: "MAIN",
            ...sharedRegistrationOptions,
          },
          {
            id: Fido2ContentScriptId.ContentScript,
            js: [Fido2ContentScript.ContentScript],
            ...sharedRegistrationOptions,
          },
        ]);
        expect(BrowserApi.unregisterContentScriptsMv3).not.toHaveBeenCalled();
      });

      it("unregisters the page-script.js and content-script.js content scripts when the enablePasskeys setting is set to `false`", async () => {
        isManifestVersionSpy.mockImplementation((manifestVersion) => manifestVersion === 3);

        enablePasskeysMock$.next(false);
        await flushPromises();

        expect(BrowserApi.unregisterContentScriptsMv3).toHaveBeenCalledWith({
          ids: [Fido2ContentScriptId.PageScript, Fido2ContentScriptId.ContentScript],
        });
        expect(BrowserApi.registerContentScriptsMv3).not.toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("extension message handlers", () => {
    beforeEach(() => {
      fido2Background.init();
    });

    it("ignores messages that do not have a handler associated with a command within the message", () => {
      const message = mock<Fido2ExtensionMessage>({ command: "nonexistentCommand" });

      sendMockExtensionMessage(message);

      expect(abortManagerMock.abort).not.toHaveBeenCalled();
    });

    it("sends a response for rejected promises returned by a handler", async () => {
      const message = mock<Fido2ExtensionMessage>({ command: "fido2RegisterCredentialRequest" });
      const sender = mock<chrome.runtime.MessageSender>();
      const sendResponse = jest.fn();
      fido2ClientService.createCredential.mockRejectedValue(new Error("error"));

      sendMockExtensionMessage(message, sender, sendResponse);
      await flushPromises();

      expect(sendResponse).toHaveBeenCalledWith({ error: { message: "error" } });
    });

    describe("fido2AbortRequest message", () => {
      it("aborts the request associated with the passed abortedRequestId", async () => {
        const message = mock<Fido2ExtensionMessage>({
          command: "fido2AbortRequest",
          abortedRequestId: "123",
        });

        sendMockExtensionMessage(message);
        await flushPromises();

        expect(abortManagerMock.abort).toHaveBeenCalledWith(message.abortedRequestId);
      });
    });

    describe("fido2RegisterCredentialRequest message", () => {
      it("creates a credential within the Fido2ClientService", async () => {
        const message = mock<Fido2ExtensionMessage>({
          command: "fido2RegisterCredentialRequest",
          requestId: "123",
          data: mock<CreateCredentialParams>(),
        });

        sendMockExtensionMessage(message, senderMock);
        await flushPromises();

        expect(fido2ClientService.createCredential).toHaveBeenCalledWith(
          message.data,
          tabMock,
          abortController,
        );
        expect(focusTabSpy).toHaveBeenCalledWith(tabMock.id);
        expect(focusWindowSpy).toHaveBeenCalledWith(tabMock.windowId);
      });
    });

    describe("fido2GetCredentialRequest", () => {
      it("asserts a credential within the Fido2ClientService", async () => {
        const message = mock<Fido2ExtensionMessage>({
          command: "fido2GetCredentialRequest",
          requestId: "123",
          data: mock<AssertCredentialParams>(),
        });

        sendMockExtensionMessage(message, senderMock);
        await flushPromises();

        expect(fido2ClientService.assertCredential).toHaveBeenCalledWith(
          message.data,
          tabMock,
          abortController,
        );
        expect(focusTabSpy).toHaveBeenCalledWith(tabMock.id);
        expect(focusWindowSpy).toHaveBeenCalledWith(tabMock.windowId);
      });
    });
  });

  describe("handle ports onConnect", () => {
    let portMock!: MockProxy<chrome.runtime.Port>;

    beforeEach(() => {
      fido2Background.init();
      portMock = createPortSpyMock(Fido2PortName.InjectedScript);
      fido2ClientService.isFido2FeatureEnabled.mockResolvedValue(true);
    });

    it("ignores port connections that do not have the correct port name", async () => {
      const port = createPortSpyMock("nonexistentPort");

      triggerRuntimeOnConnectEvent(port);
      await flushPromises();

      expect(port.onDisconnect.addListener).not.toHaveBeenCalled();
    });

    it("ignores port connections that do not have a sender url", async () => {
      portMock.sender = undefined;

      triggerRuntimeOnConnectEvent(portMock);
      await flushPromises();

      expect(portMock.onDisconnect.addListener).not.toHaveBeenCalled();
    });

    it("disconnects the port connection when the Fido2 feature is not enabled", async () => {
      fido2ClientService.isFido2FeatureEnabled.mockResolvedValue(false);

      triggerRuntimeOnConnectEvent(portMock);
      await flushPromises();

      expect(portMock.disconnect).toHaveBeenCalled();
    });

    it("disconnects the port connection when the url is malformed", async () => {
      portMock.sender.url = "malformed-url";

      triggerRuntimeOnConnectEvent(portMock);
      await flushPromises();

      expect(portMock.disconnect).toHaveBeenCalled();
      expect(logService.error).toHaveBeenCalled();
    });

    it("adds the port to the fido2ContentScriptPortsSet when the Fido2 feature is enabled", async () => {
      triggerRuntimeOnConnectEvent(portMock);
      await flushPromises();

      expect(portMock.onDisconnect.addListener).toHaveBeenCalled();
    });
  });

  describe("handleInjectScriptPortOnDisconnect", () => {
    let portMock!: MockProxy<chrome.runtime.Port>;

    beforeEach(() => {
      jest.spyOn(fido2Background as any, "handleAuthStatusUpdate").mockImplementation();
      fido2Background.init();
      portMock = createPortSpyMock(Fido2PortName.InjectedScript);
      triggerRuntimeOnConnectEvent(portMock);
      fido2Background["fido2ContentScriptPortsSet"].add(portMock);
    });

    it("does not destroy or inject the content script when the port has already disconnected before the enablePasskeys setting is set to `false`", async () => {
      triggerPortOnDisconnectEvent(portMock);

      enablePasskeysMock$.next(false);
      await flushPromises();

      expect(portMock.disconnect).not.toHaveBeenCalled();
      expect(scriptInjectorServiceMock.inject).not.toHaveBeenCalled();
    });
  });
});
