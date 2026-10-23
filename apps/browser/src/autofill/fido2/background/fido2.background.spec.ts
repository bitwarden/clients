import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { NeverDomains } from "@bitwarden/common/models/domain/domain-service";
import {
  ActiveRequest,
  Fido2ActiveRequestManager,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-active-request-manager.abstraction";
import {
  AssertCredentialParams,
  CreateCredentialParams,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-client.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Fido2ClientService } from "@bitwarden/common/platform/services/fido2/fido2-client.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { Fido2CredentialView } from "@bitwarden/common/vault/models/view/fido2-credential.view";

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
import { PermissionsPolicyBackground } from "./permissions-policy/permissions-policy.background";

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
  let getSenderFrameUrlSpy!: jest.SpyInstance;
  let getAllFrameDetailsSpy!: jest.SpyInstance;
  let blockedInteractionsUrisMock$!: BehaviorSubject<NeverDomains>;
  let neverDomainsMock$!: BehaviorSubject<NeverDomains | null>;
  // A top-level frame (0) enclosing an intermediate frame (4) enclosing a nested frame (7)
  const nestedFrameTree = [
    { frameId: 0, parentFrameId: -1, url: "https://example.com/checkout" },
    { frameId: 4, parentFrameId: 0, url: "https://wallet.example.org/pay" },
    { frameId: 7, parentFrameId: 4, url: "https://login.example.net/passkey" },
  ] as chrome.webNavigation.GetAllFrameResultDetails[];

  beforeEach(() => {
    tabMock = mock<chrome.tabs.Tab>({
      id: 123,
      url: "https://example.com",
      windowId: 456,
    });
    senderMock = mock<chrome.runtime.MessageSender>({ id: "1", tab: tabMock });
    getSenderFrameUrlSpy = jest
      .spyOn(BrowserApi, "getSenderFrameUrl")
      .mockResolvedValue("https://example.com");
    getAllFrameDetailsSpy = jest.spyOn(BrowserApi, "getAllFrameDetails").mockResolvedValue([]);
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
    const permissionsPolicyBackgroundMock = mock<PermissionsPolicyBackground>();
    permissionsPolicyBackgroundMock.isFeatureAllowedForFrame.mockResolvedValue(true);
    blockedInteractionsUrisMock$ = new BehaviorSubject<NeverDomains>({});
    neverDomainsMock$ = new BehaviorSubject<NeverDomains | null>(null);
    const domainSettingsServiceMock = mock<DomainSettingsService>();
    domainSettingsServiceMock.blockedInteractionsUris$ = blockedInteractionsUrisMock$;
    domainSettingsServiceMock.neverDomains$ = neverDomainsMock$;
    fido2Background = new Fido2Background(
      logService,
      fido2ActiveRequestManager,
      fido2ClientService,
      vaultSettingsService,
      scriptInjectorServiceMock,
      authServiceMock,
      permissionsPolicyBackgroundMock,
      domainSettingsServiceMock,
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

  describe("isCredentialRequestInProgress", () => {
    beforeEach(() => {
      fido2Background.init();
    });

    it("returns false when no credential request is active", () => {
      expect(fido2Background["isCredentialRequestInProgress"](tabMock.id)).toBe(false);
    });

    it("returns true while a register credential request is in progress", async () => {
      let duringRequestResult: boolean;
      fido2ClientService.createCredential.mockImplementation(async () => {
        duringRequestResult = fido2Background["isCredentialRequestInProgress"](tabMock.id);
        return mock();
      });

      const message = mock<Fido2ExtensionMessage>({
        command: "fido2RegisterCredentialRequest",
        requestId: "123",
        data: mock<CreateCredentialParams>(),
      });

      sendMockExtensionMessage(message, senderMock);
      await flushPromises();

      expect(duringRequestResult).toBe(true);
    });

    it("returns true while a get credential request is in progress", async () => {
      let duringRequestResult: boolean;
      fido2ClientService.assertCredential.mockImplementation(async () => {
        duringRequestResult = fido2Background["isCredentialRequestInProgress"](tabMock.id);
        return mock();
      });

      const message = mock<Fido2ExtensionMessage>({
        command: "fido2GetCredentialRequest",
        requestId: "123",
        data: mock<AssertCredentialParams>(),
      });

      sendMockExtensionMessage(message, senderMock);
      await flushPromises();

      expect(duringRequestResult).toBe(true);
    });

    it("returns false after a credential request completes", async () => {
      fido2ClientService.createCredential.mockResolvedValue(mock());

      const message = mock<Fido2ExtensionMessage>({
        command: "fido2RegisterCredentialRequest",
        requestId: "123",
        data: mock<CreateCredentialParams>(),
      });

      sendMockExtensionMessage(message, senderMock);
      await flushPromises();

      expect(fido2Background["isCredentialRequestInProgress"](tabMock.id)).toBe(false);
    });

    it("returns false after a credential request errors", async () => {
      fido2ClientService.createCredential.mockRejectedValue(new Error("error"));

      const message = mock<Fido2ExtensionMessage>({
        command: "fido2RegisterCredentialRequest",
        requestId: "123",
        data: mock<CreateCredentialParams>(),
      });

      sendMockExtensionMessage(message, senderMock);
      await flushPromises();

      expect(fido2Background["isCredentialRequestInProgress"](tabMock.id)).toBe(false);
    });
  });

  describe("shouldDeferVaultNotificationsForPasskeyUi", () => {
    beforeEach(() => {
      fido2Background.init();
    });

    it("returns false when no credential request is active", () => {
      expect(fido2Background.shouldDeferVaultNotificationsForPasskeyUi(tabMock.id)).toBe(false);
    });

    it("returns true during a register credential request without a mediated active request", async () => {
      let duringRequestResult: boolean;
      fido2ActiveRequestManager.getActiveRequest.mockReturnValue(undefined);
      fido2ClientService.createCredential.mockImplementation(async () => {
        duringRequestResult = fido2Background.shouldDeferVaultNotificationsForPasskeyUi(tabMock.id);
        return mock();
      });

      sendMockExtensionMessage(
        mock<Fido2ExtensionMessage>({
          command: "fido2RegisterCredentialRequest",
          requestId: "123",
          data: mock<CreateCredentialParams>(),
        }),
        senderMock,
      );
      await flushPromises();

      expect(duringRequestResult!).toBe(true);
    });

    it("returns true during a non-conditional get credential request without a mediated active request", async () => {
      let duringRequestResult: boolean;
      fido2ActiveRequestManager.getActiveRequest.mockReturnValue(undefined);
      fido2ClientService.assertCredential.mockImplementation(async () => {
        duringRequestResult = fido2Background.shouldDeferVaultNotificationsForPasskeyUi(tabMock.id);
        return mock();
      });

      sendMockExtensionMessage(
        mock<Fido2ExtensionMessage>({
          command: "fido2GetCredentialRequest",
          requestId: "123",
          data: mock<AssertCredentialParams>({ mediation: "optional" }),
        }),
        senderMock,
      );
      await flushPromises();

      expect(duringRequestResult!).toBe(true);
    });

    it("returns false during conditional mediation when no passkeys are available", async () => {
      let duringRequestResult: boolean;
      fido2ActiveRequestManager.getActiveRequest.mockReturnValue(
        mock<ActiveRequest>({ credentials: [] }),
      );
      fido2ClientService.assertCredential.mockImplementation(async () => {
        duringRequestResult = fido2Background.shouldDeferVaultNotificationsForPasskeyUi(tabMock.id);
        return mock();
      });

      const message = mock<Fido2ExtensionMessage>({
        command: "fido2GetCredentialRequest",
        requestId: "123",
        data: mock<AssertCredentialParams>(),
      });

      sendMockExtensionMessage(message, senderMock);
      await flushPromises();

      expect(duringRequestResult!).toBe(false);
    });

    it("returns true when conditional mediation has credentials to show", () => {
      fido2Background["activeCredentialRequests"].add(tabMock.id);
      fido2ActiveRequestManager.getActiveRequest.mockReturnValue(
        mock<ActiveRequest>({
          credentials: [mock<Fido2CredentialView>({ credentialId: "credential-id" })],
        }),
      );

      expect(fido2Background.shouldDeferVaultNotificationsForPasskeyUi(tabMock.id)).toBe(true);
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
          expect.objectContaining({
            id: tabMock.id,
            windowId: tabMock.windowId,
            requestFrameUrl: "https://example.com",
          }),
          abortController,
        );
        expect(focusTabSpy).toHaveBeenCalledWith(tabMock.id);
        expect(focusWindowSpy).toHaveBeenCalledWith(tabMock.windowId);
      });

      it("passes the requesting sub-frame's URL rather than the tab's", async () => {
        const frameUrl = "https://login.example.net/passkey";
        getSenderFrameUrlSpy.mockResolvedValue(frameUrl);
        const subFrameSender = mock<chrome.runtime.MessageSender>({
          id: "1",
          tab: tabMock,
          frameId: 4,
        });
        const message = mock<Fido2ExtensionMessage>({
          command: "fido2RegisterCredentialRequest",
          requestId: "123",
          data: mock<CreateCredentialParams>(),
        });

        sendMockExtensionMessage(message, subFrameSender);
        await flushPromises();

        expect(getSenderFrameUrlSpy).toHaveBeenCalledWith(subFrameSender);
        expect(fido2ClientService.createCredential).toHaveBeenCalledWith(
          message.data,
          expect.objectContaining({ id: tabMock.id, requestFrameUrl: frameUrl }),
          abortController,
        );
      });

      it("falls back to the tab URL when the requesting frame's URL cannot be resolved", async () => {
        getSenderFrameUrlSpy.mockResolvedValue(undefined);
        const message = mock<Fido2ExtensionMessage>({
          command: "fido2RegisterCredentialRequest",
          requestId: "123",
          data: mock<CreateCredentialParams>(),
        });

        sendMockExtensionMessage(message, senderMock);
        await flushPromises();

        expect(fido2ClientService.createCredential).toHaveBeenCalledWith(
          message.data,
          expect.objectContaining({ requestFrameUrl: tabMock.url }),
          abortController,
        );
      });

      describe("with domain rules for enclosing frames", () => {
        const sendRegisterRequest = (frameId: number) => {
          const sendResponse = jest.fn();
          const sender = mock<chrome.runtime.MessageSender>({ id: "1", tab: tabMock, frameId });
          const message = mock<Fido2ExtensionMessage>({
            command: "fido2RegisterCredentialRequest",
            requestId: "123",
            data: mock<CreateCredentialParams>(),
          });

          sendMockExtensionMessage(message, sender, sendResponse);

          return sendResponse;
        };

        beforeEach(() => {
          getAllFrameDetailsSpy.mockResolvedValue(nestedFrameTree);
        });

        it.each([
          ["excluded", () => neverDomainsMock$.next({ "wallet.example.org": null })],
          ["blocked", () => blockedInteractionsUrisMock$.next({ "example.org": null })],
        ])(
          "requests a browser fallback when an intermediate enclosing frame's domain is %s",
          async (_ruleType, applyRule) => {
            applyRule();

            const sendResponse = sendRegisterRequest(7);
            await flushPromises();

            expect(getAllFrameDetailsSpy).toHaveBeenCalledWith(tabMock.id);
            expect(fido2ClientService.createCredential).not.toHaveBeenCalled();
            expect(sendResponse).toHaveBeenCalledWith({
              error: expect.objectContaining({ fallbackRequested: true }),
            });
          },
        );

        it("requests a browser fallback when the top-level frame's domain is excluded", async () => {
          neverDomainsMock$.next({ "example.com": null });

          sendRegisterRequest(7);
          await flushPromises();

          expect(fido2ClientService.createCredential).not.toHaveBeenCalled();
        });

        it("does not apply a nested frame's domain rule to the frames enclosing it", async () => {
          neverDomainsMock$.next({ "login.example.net": null });

          sendRegisterRequest(4);
          await flushPromises();

          expect(fido2ClientService.createCredential).toHaveBeenCalled();
        });

        it("leaves the requesting frame's own domain rule to the Fido2ClientService", async () => {
          neverDomainsMock$.next({ "example.com": null });

          sendRegisterRequest(0);
          await flushPromises();

          expect(getAllFrameDetailsSpy).not.toHaveBeenCalled();
          expect(fido2ClientService.createCredential).toHaveBeenCalled();
        });

        it("skips reading the frame tree when there are no domain rules", async () => {
          sendRegisterRequest(7);
          await flushPromises();

          expect(getAllFrameDetailsSpy).not.toHaveBeenCalled();
          expect(fido2ClientService.createCredential).toHaveBeenCalled();
        });

        it("checks the tab URL when the frame tree cannot be resolved", async () => {
          getAllFrameDetailsSpy.mockResolvedValue(null);
          neverDomainsMock$.next({ "example.com": null });

          sendRegisterRequest(7);
          await flushPromises();

          expect(fido2ClientService.createCredential).not.toHaveBeenCalled();
        });
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
          expect.objectContaining({
            id: tabMock.id,
            windowId: tabMock.windowId,
            requestFrameUrl: "https://example.com",
          }),
          abortController,
        );
        expect(focusTabSpy).toHaveBeenCalledWith(tabMock.id);
        expect(focusWindowSpy).toHaveBeenCalledWith(tabMock.windowId);
      });

      it("requests a browser fallback when an enclosing frame's domain is excluded", async () => {
        getAllFrameDetailsSpy.mockResolvedValue(nestedFrameTree);
        neverDomainsMock$.next({ "wallet.example.org": null });
        const sendResponse = jest.fn();
        const nestedFrameSender = mock<chrome.runtime.MessageSender>({
          id: "1",
          tab: tabMock,
          frameId: 7,
        });
        const message = mock<Fido2ExtensionMessage>({
          command: "fido2GetCredentialRequest",
          requestId: "123",
          data: mock<AssertCredentialParams>(),
        });

        sendMockExtensionMessage(message, nestedFrameSender, sendResponse);
        await flushPromises();

        expect(fido2ClientService.assertCredential).not.toHaveBeenCalled();
        expect(sendResponse).toHaveBeenCalledWith({
          error: expect.objectContaining({ fallbackRequested: true }),
        });
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

    describe("with domain rules for enclosing frames", () => {
      beforeEach(() => {
        getAllFrameDetailsSpy.mockResolvedValue(nestedFrameTree);
        portMock.sender.url = "https://login.example.net/passkey";
        portMock.sender.frameId = 7;
      });

      it("disconnects a nested frame's port connection when an enclosing frame's domain is excluded", async () => {
        neverDomainsMock$.next({ "wallet.example.org": null });

        triggerRuntimeOnConnectEvent(portMock);
        await flushPromises();

        expect(portMock.disconnect).toHaveBeenCalled();
        expect(portMock.onDisconnect.addListener).not.toHaveBeenCalled();
      });

      it("disconnects a nested frame's port connection when an enclosing frame's domain is blocked by suffix", async () => {
        blockedInteractionsUrisMock$.next({ "example.org": null });

        triggerRuntimeOnConnectEvent(portMock);
        await flushPromises();

        expect(portMock.disconnect).toHaveBeenCalled();
      });

      it("matches an enclosing frame's excluded domain by exact hostname", async () => {
        neverDomainsMock$.next({ "example.org": null });

        triggerRuntimeOnConnectEvent(portMock);
        await flushPromises();

        expect(portMock.disconnect).not.toHaveBeenCalled();
        expect(portMock.onDisconnect.addListener).toHaveBeenCalled();
      });
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
