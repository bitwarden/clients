// import registerContentScript from "content-scripts-register-polyfill/ponyfill.js";
import { mock } from "jest-mock-extended";
import { Observable } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AssertCredentialParams,
  CreateCredentialParams,
} from "@bitwarden/common/vault/abstractions/fido2/fido2-client.service.abstraction";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { Fido2ClientService } from "@bitwarden/common/vault/services/fido2/fido2-client.service";

import { createPortSpyMock } from "../../../autofill/spec/autofill-mocks";
import {
  flushPromises,
  sendExtensionRuntimeMessage,
  triggerRuntimeOnConnectEvent,
} from "../../../autofill/spec/testing-utils";
import { BrowserApi } from "../../../platform/browser/browser-api";
import { AbortManager } from "../../background/abort-manager";
import { Fido2ContentScript, Fido2ContentScriptId } from "../enums/fido2-content-script.enum";
import { Fido2PortName } from "../enums/fido2-port-name.enum";

import { Fido2ExtensionMessage } from "./abstractions/fido2.background";
import Fido2Background from "./fido2.background";

const sharedExecuteScriptOptions = { runAt: "document_start", allFrames: true };
const contentScriptDetails = {
  file: Fido2ContentScript.ContentScript,
  ...sharedExecuteScriptOptions,
};

describe("Fido2Background", () => {
  const abortManager: AbortManager = mock<AbortManager>();
  const abortController: AbortController = mock<AbortController>();
  const logService: LogService = mock<LogService>();
  let fido2ClientService: Fido2ClientService;
  let vaultSettingsService: VaultSettingsService;
  let fido2Background: Fido2Background;
  const tabMock: chrome.tabs.Tab = mock<chrome.tabs.Tab>({
    id: 123,
    url: "https://example.com",
    windowId: 456,
  });
  const senderMock = mock<chrome.runtime.MessageSender>({ id: "1", tab: tabMock });
  const tabsQuerySpy: jest.SpyInstance = jest.spyOn(BrowserApi, "tabsQuery");
  const executeTabsSpy: jest.SpyInstance = jest.spyOn(BrowserApi, "executeScriptInTab");
  const isManifestVersionSpy: jest.SpyInstance = jest.spyOn(BrowserApi, "isManifestVersion");
  const focusTabSpy: jest.SpyInstance = jest.spyOn(BrowserApi, "focusTab").mockResolvedValue();
  const focusWindowSpy: jest.SpyInstance = jest
    .spyOn(BrowserApi, "focusWindow")
    .mockResolvedValue();

  beforeEach(() => {
    fido2ClientService = mock<Fido2ClientService>();
    vaultSettingsService = mock<VaultSettingsService>({
      enablePasskeys$: mock<Observable<boolean>>(),
    });
    fido2Background = new Fido2Background(logService, fido2ClientService, vaultSettingsService);
    fido2Background["abortManager"] = abortManager;
    fido2Background.init();
    executeTabsSpy.mockImplementation();
    abortManager.runWithAbortController = jest.fn((requestId, runner) => runner(abortController));
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe("injectFido2ContentScriptsInAllTabs", () => {
    it("skips injecting the FIDO2 content scripts into tabs that do not have a secure url protocol", async () => {
      const insecureTab = mock<chrome.tabs.Tab>({ id: 789, url: "http://example.com" });
      tabsQuerySpy.mockResolvedValueOnce([insecureTab]);

      await fido2Background.injectFido2ContentScriptsInAllTabs();

      expect(executeTabsSpy).not.toHaveBeenCalled();
    });

    it("injects the FIDO2 content scripts that contain a secure url protocol", async () => {
      const secondTabMock = mock<chrome.tabs.Tab>({ id: 456, url: "https://example.com" });
      const insecureTab = mock<chrome.tabs.Tab>({ id: 789, url: "http://example.com" });
      const noUrlTab = mock<chrome.tabs.Tab>({ id: 101, url: undefined });
      tabsQuerySpy.mockResolvedValueOnce([tabMock, secondTabMock, insecureTab, noUrlTab]);

      await fido2Background.injectFido2ContentScriptsInAllTabs();

      expect(BrowserApi.executeScriptInTab).toHaveBeenCalledWith(tabMock.id, contentScriptDetails);
      expect(BrowserApi.executeScriptInTab).toHaveBeenCalledWith(
        secondTabMock.id,
        contentScriptDetails,
      );
      expect(BrowserApi.executeScriptInTab).not.toHaveBeenCalledWith(
        insecureTab.id,
        contentScriptDetails,
      );
      expect(BrowserApi.executeScriptInTab).not.toHaveBeenCalledWith(
        noUrlTab.id,
        contentScriptDetails,
      );
    });
  });

  describe("injectFido2ContentScripts", () => {
    it("injects the fido2 page-script-mv2-append content script into the provided tab", async () => {
      isManifestVersionSpy.mockImplementation((manifestVersion) => manifestVersion === 2);

      await fido2Background["injectFido2ContentScripts"](tabMock);

      expect(BrowserApi.executeScriptInTab).toHaveBeenCalledWith(tabMock.id, {
        file: Fido2ContentScript.PageScriptAppend,
        ...sharedExecuteScriptOptions,
      });
    });

    it("injects the fido2 default page-script content script into the provided tab", async () => {
      isManifestVersionSpy.mockImplementation((manifestVersion) => manifestVersion === 3);

      await fido2Background["injectFido2ContentScripts"](tabMock);

      expect(BrowserApi.executeScriptInTab).toHaveBeenCalledWith(
        tabMock.id,
        { file: Fido2ContentScript.PageScript, ...sharedExecuteScriptOptions },
        { world: "MAIN" },
      );
    });

    it("injects the fido2 content-script into the provided tab", async () => {
      fido2ClientService.isFido2FeatureEnabled = jest.fn().mockResolvedValue(true);

      await fido2Background["injectFido2ContentScripts"](tabMock);

      expect(BrowserApi.executeScriptInTab).toHaveBeenCalledWith(tabMock.id, contentScriptDetails);
    });
  });

  describe("handleEnablePasskeysUpdate", () => {
    const portMock: chrome.runtime.Port = mock<chrome.runtime.Port>();

    beforeEach(() => {
      jest.spyOn(BrowserApi, "registerContentScriptsMv2");
      jest.spyOn(BrowserApi, "registerContentScriptsMv3");
      jest.spyOn(BrowserApi, "unregisterContentScriptsMv3");
      fido2Background["fido2ContentScriptPortsSet"] = new Set<chrome.runtime.Port>([
        portMock,
        mock<chrome.runtime.Port>(),
      ]);
      tabsQuerySpy.mockResolvedValue([tabMock]);
    });

    it("skips destroying and re-injecting the content scripts if the enablePasskeys setting is first being read", async () => {
      await fido2Background["handleEnablePasskeysUpdate"](true);

      expect(fido2Background["fido2ContentScriptPortsSet"].size).toBe(2);
      expect(executeTabsSpy).not.toHaveBeenCalled();
    });

    it("destroys the content scripts but skips re-injecting them if the enablePasskeys setting is set to `false`", async () => {
      fido2Background["currentEnablePasskeysSetting"] = true;

      await fido2Background["handleEnablePasskeysUpdate"](false);

      expect(portMock.disconnect).toHaveBeenCalled();
      expect(fido2Background["fido2ContentScriptPortsSet"].size).toBe(0);
      expect(executeTabsSpy).not.toHaveBeenCalled();
    });

    it("destroys and re-injects the content scripts if the enablePasskeys setting is set to `true`", async () => {
      fido2Background["currentEnablePasskeysSetting"] = false;

      await fido2Background["handleEnablePasskeysUpdate"](true);

      expect(portMock.disconnect).toHaveBeenCalled();
      expect(fido2Background["fido2ContentScriptPortsSet"].size).toBe(0);
      expect(executeTabsSpy).toHaveBeenCalledWith(tabMock.id, contentScriptDetails);
    });

    it("registers the page-script-append-mv2.js and content-script.js content scripts for manifest v2 if the enablePasskeys setting is turned on", async () => {
      jest
        .spyOn(BrowserApi, "isManifestVersion")
        .mockImplementation((manifestVersion) => manifestVersion === 2);

      await fido2Background["handleEnablePasskeysUpdate"](true);

      expect(BrowserApi.registerContentScriptsMv2).toHaveBeenCalledWith({
        js: [
          { file: Fido2ContentScript.PageScriptAppend },
          { file: Fido2ContentScript.ContentScript },
        ],
        ...fido2Background["sharedRegistrationOptions"],
      });
    });

    it("unregisters any existing registered content scripts for manifest v2 if the enablePasskeys setting is turned off", async () => {
      jest
        .spyOn(BrowserApi, "isManifestVersion")
        .mockImplementation((manifestVersion) => manifestVersion === 2);
      fido2Background["registeredContentScripts"] = {
        unregister: jest.fn(),
      };

      await fido2Background["handleEnablePasskeysUpdate"](false);

      expect(fido2Background["registeredContentScripts"].unregister).toHaveBeenCalled();
      expect(BrowserApi.registerContentScriptsMv2).not.toHaveBeenCalled();
    });

    it("registers the page-script.js and content-script.js content scripts for manifest v3 if the enablePasskeys setting is turned on", async () => {
      jest
        .spyOn(BrowserApi, "isManifestVersion")
        .mockImplementation((manifestVersion) => manifestVersion === 3);

      await fido2Background["handleEnablePasskeysUpdate"](true);

      expect(BrowserApi.registerContentScriptsMv3).toHaveBeenCalledWith([
        {
          id: Fido2ContentScriptId.PageScript,
          js: [Fido2ContentScript.PageScript],
          world: "MAIN",
          ...fido2Background["sharedRegistrationOptions"],
        },
        {
          id: Fido2ContentScriptId.ContentScript,
          js: [Fido2ContentScript.ContentScript],
          ...fido2Background["sharedRegistrationOptions"],
        },
      ]);
      expect(BrowserApi.unregisterContentScriptsMv3).not.toHaveBeenCalled();
    });

    it("unregisters the FIDO2 page-script.js and content-script.js content scripts for manifest v3 if the enablePasskeys setting is turned off", async () => {
      jest
        .spyOn(BrowserApi, "isManifestVersion")
        .mockImplementation((manifestVersion) => manifestVersion === 3);

      await fido2Background["handleEnablePasskeysUpdate"](false);

      expect(BrowserApi.unregisterContentScriptsMv3).toHaveBeenCalledWith({
        ids: [Fido2ContentScriptId.PageScript, Fido2ContentScriptId.ContentScript],
      });
      expect(BrowserApi.registerContentScriptsMv3).not.toHaveBeenCalled();
    });
  });

  describe("extension message handlers", () => {
    it("ignores messages who do not have a handler associated with a command within the message", () => {
      const message = mock<Fido2ExtensionMessage>({ command: "nonexistentCommand" });

      sendExtensionRuntimeMessage(message);

      expect(fido2Background["abortManager"].abort).not.toHaveBeenCalled();
    });

    it("sends a response for rejected promises returned by a handler", async () => {
      const message = mock<Fido2ExtensionMessage>({ command: "fido2RegisterCredentialRequest" });
      const sender = mock<chrome.runtime.MessageSender>();
      const sendResponse = jest.fn();
      jest.spyOn(fido2ClientService, "createCredential").mockRejectedValue(new Error("error"));

      sendExtensionRuntimeMessage(message, sender, sendResponse);
      await flushPromises();

      expect(sendResponse).toHaveBeenCalledWith({ error: { message: "error" } });
    });

    describe("fido2AbortRequest message", () => {
      it("aborts the request associated with the passed abortedRequestId", async () => {
        const message = mock<Fido2ExtensionMessage>({
          command: "fido2AbortRequest",
          abortedRequestId: "123",
        });

        sendExtensionRuntimeMessage(message);
        await flushPromises();

        expect(fido2Background["abortManager"].abort).toHaveBeenCalledWith(
          message.abortedRequestId,
        );
      });
    });

    describe("fido2RegisterCredentialRequest message", () => {
      it("creates a credential within the Fido2ClientService", async () => {
        const message = mock<Fido2ExtensionMessage>({
          command: "fido2RegisterCredentialRequest",
          requestId: "123",
          data: mock<CreateCredentialParams>(),
        });
        const createCredentialSpy: jest.SpyInstance = jest.spyOn(
          fido2ClientService,
          "createCredential",
        );

        sendExtensionRuntimeMessage(message, senderMock);
        await flushPromises();

        expect(createCredentialSpy).toHaveBeenCalledWith(message.data, tabMock, abortController);
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
        const assertCredentialSpy: jest.SpyInstance = jest.spyOn(
          fido2ClientService,
          "assertCredential",
        );

        sendExtensionRuntimeMessage(message, senderMock);
        await flushPromises();

        expect(assertCredentialSpy).toHaveBeenCalledWith(message.data, tabMock, abortController);
        expect(focusTabSpy).toHaveBeenCalledWith(tabMock.id);
        expect(focusWindowSpy).toHaveBeenCalledWith(tabMock.windowId);
      });
    });
  });

  describe("handle ports onConnect", () => {
    let portMock: chrome.runtime.Port;
    let isFido2FeatureEnabledSpy: jest.SpyInstance;

    beforeEach(() => {
      portMock = createPortSpyMock(Fido2PortName.InjectedScript);
      isFido2FeatureEnabledSpy = jest
        .spyOn(fido2ClientService, "isFido2FeatureEnabled")
        .mockResolvedValue(true);
    });

    it("ignores port connections that do not have the correct port name", async () => {
      const port = createPortSpyMock("nonexistentPort");

      triggerRuntimeOnConnectEvent(port);
      await flushPromises();

      expect(fido2Background["fido2ContentScriptPortsSet"].size).toBe(0);
      expect(port.onDisconnect.addListener).not.toHaveBeenCalled();
    });

    it("ignores port connections that do not have a sender url", async () => {
      portMock.sender = undefined;

      triggerRuntimeOnConnectEvent(portMock);
      await flushPromises();

      expect(fido2Background["fido2ContentScriptPortsSet"].size).toBe(0);
      expect(portMock.onDisconnect.addListener).not.toHaveBeenCalled();
    });

    it("disconnects the port connection if the Fido2 feature is not enabled", async () => {
      isFido2FeatureEnabledSpy.mockResolvedValue(false);

      triggerRuntimeOnConnectEvent(portMock);
      await flushPromises();

      expect(portMock.disconnect).toHaveBeenCalled();
      expect(fido2Background["fido2ContentScriptPortsSet"].size).toBe(0);
    });

    it("disconnects the port connection if the url is malformed", async () => {
      portMock.sender.url = "malformed-url";

      triggerRuntimeOnConnectEvent(portMock);
      await flushPromises();

      expect(portMock.disconnect).toHaveBeenCalled();
      expect(fido2Background["fido2ContentScriptPortsSet"].size).toBe(0);
      expect(logService.error).toHaveBeenCalled();
    });

    it("adds the port to the fido2ContentScriptPortsSet if the Fido2 feature is enabled", async () => {
      triggerRuntimeOnConnectEvent(portMock);
      await flushPromises();

      expect(fido2Background["fido2ContentScriptPortsSet"].size).toBe(1);
      expect(portMock.onDisconnect.addListener).toHaveBeenCalled();
    });
  });

  describe("handleInjectScriptPortOnDisconnect", () => {
    let portMock: chrome.runtime.Port;

    beforeEach(() => {
      portMock = createPortSpyMock(Fido2PortName.InjectedScript);
      fido2Background["fido2ContentScriptPortsSet"].add(portMock);
    });

    it("ignores the port disconnection if it does not have the correct name", () => {
      const port = createPortSpyMock("nonexistentPort");

      fido2Background["handleInjectScriptPortOnDisconnect"](port);

      expect(fido2Background["fido2ContentScriptPortsSet"].size).toBe(1);
    });

    it("removes the port from the fido2ContentScriptPortsSet", () => {
      fido2Background["handleInjectScriptPortOnDisconnect"](portMock);

      expect(fido2Background["fido2ContentScriptPortsSet"].size).toBe(0);
    });
  });
});
