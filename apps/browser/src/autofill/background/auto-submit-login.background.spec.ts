import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { BrowserApi } from "../../platform/browser/browser-api";
import { ScriptInjectorService } from "../../platform/services/abstractions/script-injector.service";
import AutofillPageDetails from "../models/autofill-page-details";
import { AutofillService } from "../services/abstractions/autofill.service";
import {
  flushPromises,
  sendMockExtensionMessage,
  triggerTabOnActivatedEvent,
  triggerTabOnRemovedEvent,
  triggerTabOnUpdatedEvent,
  triggerWebNavigationOnCompletedEvent,
  triggerWebRequestOnBeforeRedirectEvent,
  triggerWebRequestOnBeforeRequestEvent,
} from "../spec/testing-utils";

import { AutoSubmitLoginBackground } from "./auto-submit-login.background";

describe("AutoSubmitLoginBackground", () => {
  let logService: MockProxy<LogService>;
  let autofillService: MockProxy<AutofillService>;
  let scriptInjectorService: MockProxy<ScriptInjectorService>;
  let authStatus$: BehaviorSubject<AuthenticationStatus>;
  let authService: MockProxy<AuthService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let policyDetails: MockProxy<Policy>;
  let automaticAppLogInPolicy$: BehaviorSubject<Policy[]>;
  let policyAppliesToUser$: BehaviorSubject<boolean>;
  let policyService: MockProxy<PolicyService>;
  let autoSubmitLoginBackground: AutoSubmitLoginBackground;
  let accountService: FakeAccountService;
  const mockUserId = Utils.newGuid() as UserId;
  const validIpdUrl1 = "https://example.com";
  const validIpdUrl2 = "https://subdomain.example3.com";
  const validAutoSubmitHost = "some-valid-url.com";
  const validAutoSubmitUrl = `https://${validAutoSubmitHost}/#autosubmit=1`;

  beforeEach(() => {
    logService = mock<LogService>();
    autofillService = mock<AutofillService>();
    scriptInjectorService = mock<ScriptInjectorService>();
    authStatus$ = new BehaviorSubject(AuthenticationStatus.Unlocked);
    authService = mock<AuthService>();
    authService.activeAccountStatus$ = authStatus$;
    platformUtilsService = mock<PlatformUtilsService>();
    policyDetails = mock<Policy>({
      enabled: true,
      data: {
        idpHost: `${validIpdUrl1} , https://example2.com/some/sub-route ,${validIpdUrl2}, [invalidValue] ,,`,
      },
    });
    automaticAppLogInPolicy$ = new BehaviorSubject<Policy[]>([policyDetails]);
    policyAppliesToUser$ = new BehaviorSubject<boolean>(true);
    policyService = mock<PolicyService>({
      policiesByType$: jest.fn().mockReturnValue(automaticAppLogInPolicy$),
      policyAppliesToUser$: jest.fn().mockReturnValue(policyAppliesToUser$),
    });
    accountService = mockAccountServiceWith(mockUserId);
    autoSubmitLoginBackground = new AutoSubmitLoginBackground(
      logService,
      autofillService,
      scriptInjectorService,
      authService,
      platformUtilsService,
      policyService,
      accountService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("when conditions prevent auto-submit policy activation", () => {
    it("destroys all event listeners when the AutomaticAppLogIn policy is not enabled", async () => {
      automaticAppLogInPolicy$.next([mock<Policy>({ ...policyDetails, enabled: false })]);

      await autoSubmitLoginBackground.init();

      expect(chrome.webRequest.onBeforeRequest.removeListener).toHaveBeenCalled();
    });

    it("destroys all event listeners when the AutomaticAppLogIn policy does not apply to the current user", async () => {
      policyAppliesToUser$.next(false);

      await autoSubmitLoginBackground.init();

      expect(chrome.webRequest.onBeforeRequest.removeListener).toHaveBeenCalled();
    });

    it("destroys all event listeners when the idpHost is not specified in the AutomaticAppLogIn policy", async () => {
      automaticAppLogInPolicy$.next([mock<Policy>({ ...policyDetails, data: { idpHost: "" } })]);

      await autoSubmitLoginBackground.init();

      expect(chrome.webRequest.onBeforeRequest.addListener).not.toHaveBeenCalled();
    });
  });

  describe("when the AutomaticAppLogIn policy is valid and active", () => {
    let webRequestDetails: chrome.webRequest.WebRequestBodyDetails;

    describe("starting the auto-submit login workflow", () => {
      beforeEach(async () => {
        webRequestDetails = mock<chrome.webRequest.WebRequestBodyDetails>({
          initiator: validIpdUrl1,
          url: validAutoSubmitUrl,
          type: "main_frame",
          tabId: 1,
        });
        await autoSubmitLoginBackground.init();
      });

      it("sets up the auto-submit workflow when the web request occurs in the main frame and the destination URL contains a valid auto-fill hash", () => {
        triggerWebRequestOnBeforeRequestEvent(webRequestDetails);

        expect(autoSubmitLoginBackground["currentAutoSubmitHostData"]).toStrictEqual({
          url: validAutoSubmitUrl,
          tabId: webRequestDetails.tabId,
        });
        expect(chrome.webNavigation.onCompleted.addListener).toBeCalledWith(expect.any(Function), {
          url: [{ hostEquals: validAutoSubmitHost }],
        });
      });

      it("sets up the auto-submit workflow when the web request occurs in a sub frame and the initiator of the request is a valid auto-submit host", async () => {
        const topFrameHost = "some-top-frame.com";
        const subFrameHost = "some-sub-frame.com";
        autoSubmitLoginBackground["validAutoSubmitHosts"].add(topFrameHost);
        webRequestDetails.type = "sub_frame";
        webRequestDetails.initiator = `https://${topFrameHost}`;
        webRequestDetails.url = `https://${subFrameHost}`;

        triggerWebRequestOnBeforeRequestEvent(webRequestDetails);

        expect(chrome.webNavigation.onCompleted.addListener).toBeCalledWith(expect.any(Function), {
          url: [{ hostEquals: subFrameHost }],
        });
      });

      describe("injecting the auto-submit login content script", () => {
        let webNavigationDetails: chrome.webNavigation.WebNavigationFramedCallbackDetails;

        beforeEach(() => {
          triggerWebRequestOnBeforeRequestEvent(webRequestDetails);
          webNavigationDetails = mock<chrome.webNavigation.WebNavigationFramedCallbackDetails>({
            tabId: webRequestDetails.tabId,
            url: webRequestDetails.url,
          });
        });

        it("skips injecting the content script when the routed-to url is invalid", () => {
          webNavigationDetails.url = "[invalid-host]";

          triggerWebNavigationOnCompletedEvent(webNavigationDetails);

          expect(scriptInjectorService.inject).not.toHaveBeenCalled();
        });

        it("skips injecting the content script when the extension is not unlocked", async () => {
          authStatus$.next(AuthenticationStatus.Locked);

          triggerWebNavigationOnCompletedEvent(webNavigationDetails);
          await flushPromises();

          expect(scriptInjectorService.inject).not.toHaveBeenCalled();
        });

        it("injects the auto-submit login content script", async () => {
          triggerWebNavigationOnCompletedEvent(webNavigationDetails);
          await flushPromises();

          expect(scriptInjectorService.inject).toBeCalledWith({
            tabId: webRequestDetails.tabId,
            injectDetails: {
              file: "content/auto-submit-login.js",
              runAt: "document_start",
              frame: "all_frames",
            },
          });
        });
      });
    });

    describe("cancelling an active auto-submit login workflow", () => {
      beforeEach(async () => {
        webRequestDetails = mock<chrome.webRequest.WebRequestBodyDetails>({
          initiator: validIpdUrl1,
          url: validAutoSubmitUrl,
          type: "main_frame",
        });
        await autoSubmitLoginBackground.init();
        autoSubmitLoginBackground["currentAutoSubmitHostData"] = {
          url: validAutoSubmitUrl,
          tabId: webRequestDetails.tabId,
        };
        autoSubmitLoginBackground["validAutoSubmitHosts"].add(validAutoSubmitHost);
      });

      it("clears the auto-submit data when a POST request is encountered during an active auto-submit login workflow", async () => {
        webRequestDetails.method = "POST";

        triggerWebRequestOnBeforeRequestEvent(webRequestDetails);

        expect(autoSubmitLoginBackground["currentAutoSubmitHostData"]).toStrictEqual({});
      });

      it("clears the auto-submit data when a redirection to an invalid host is made during an active auto-submit workflow", () => {
        webRequestDetails.url = "https://invalid-host.com";

        triggerWebRequestOnBeforeRequestEvent(webRequestDetails);

        expect(autoSubmitLoginBackground["currentAutoSubmitHostData"]).toStrictEqual({});
      });

      it("disables the auto-submit workflow if a web request is initiated after the auto-submit route has been visited", () => {
        webRequestDetails.url = `https://${validAutoSubmitHost}`;
        webRequestDetails.initiator = `https://${validAutoSubmitHost}#autosubmit=1`;

        triggerWebRequestOnBeforeRequestEvent(webRequestDetails);

        expect(autoSubmitLoginBackground["validAutoSubmitHosts"].has(validAutoSubmitHost)).toBe(
          false,
        );
      });

      it("disables the auto-submit workflow if a web request to a different page is initiated after the auto-submit route has been visited", async () => {
        webRequestDetails.url = `https://${validAutoSubmitHost}/some-other-route.com`;
        jest
          .spyOn(BrowserApi, "getTab")
          .mockResolvedValue(mock<chrome.tabs.Tab>({ url: validAutoSubmitHost }));

        triggerWebRequestOnBeforeRequestEvent(webRequestDetails);
        await flushPromises();

        expect(autoSubmitLoginBackground["validAutoSubmitHosts"].has(validAutoSubmitHost)).toBe(
          false,
        );
      });
    });

    describe("when the extension is running on a Safari browser", () => {
      const tabId = 1;
      const tab = mock<chrome.tabs.Tab>({ id: tabId, url: validIpdUrl1 });

      beforeEach(() => {
        platformUtilsService.isSafari.mockReturnValue(true);
        autoSubmitLoginBackground = new AutoSubmitLoginBackground(
          logService,
          autofillService,
          scriptInjectorService,
          authService,
          platformUtilsService,
          policyService,
          accountService,
        );
        jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValue(tab);
      });

      it("sets the most recent IDP host to the current tab", async () => {
        await autoSubmitLoginBackground.init();
        await flushPromises();

        expect(autoSubmitLoginBackground["mostRecentIdpHost"]).toStrictEqual({
          url: validIpdUrl1,
          tabId: tabId,
        });
      });

      describe("requests that occur within a sub-frame", () => {
        const webRequestDetails = mock<chrome.webRequest.WebRequestBodyDetails>({
          url: validAutoSubmitUrl,
          frameId: 1,
        });

        it("sets the initiator of the request to an empty value when the most recent IDP host has not be set", async () => {
          jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValue(null);
          await autoSubmitLoginBackground.init();
          await flushPromises();
          autoSubmitLoginBackground["validAutoSubmitHosts"].add(validAutoSubmitHost);

          triggerWebRequestOnBeforeRequestEvent(webRequestDetails);

          expect(chrome.webNavigation.onCompleted.addListener).not.toHaveBeenCalledWith(
            autoSubmitLoginBackground["handleAutoSubmitHostNavigationCompleted"],
            { url: [{ hostEquals: validAutoSubmitHost }] },
          );
        });

        it("treats the routed to url as the initiator of a request", async () => {
          await autoSubmitLoginBackground.init();
          await flushPromises();
          autoSubmitLoginBackground["validAutoSubmitHosts"].add(validAutoSubmitHost);

          triggerWebRequestOnBeforeRequestEvent(webRequestDetails);

          expect(chrome.webNavigation.onCompleted.addListener).toBeCalledWith(
            autoSubmitLoginBackground["handleAutoSubmitHostNavigationCompleted"],
            { url: [{ hostEquals: validAutoSubmitHost }] },
          );
        });
      });

      describe("event listeners that update the most recently visited IDP host", () => {
        const newTabId = 2;
        const newTab = mock<chrome.tabs.Tab>({ id: newTabId, url: validIpdUrl2 });

        beforeEach(async () => {
          await autoSubmitLoginBackground.init();
        });

        it("updates the most recent idp host when a tab is activated", async () => {
          jest.spyOn(BrowserApi, "getTab").mockResolvedValue(newTab);

          triggerTabOnActivatedEvent(mock<chrome.tabs.TabActiveInfo>({ tabId: newTabId }));
          await flushPromises();

          expect(autoSubmitLoginBackground["mostRecentIdpHost"]).toStrictEqual({
            url: validIpdUrl2,
            tabId: newTabId,
          });
        });

        it("updates the most recent id host when a tab is updated", () => {
          triggerTabOnUpdatedEvent(
            newTabId,
            mock<chrome.tabs.TabChangeInfo>({ url: validIpdUrl1 }),
            newTab,
          );

          expect(autoSubmitLoginBackground["mostRecentIdpHost"]).toStrictEqual({
            url: validIpdUrl1,
            tabId: newTabId,
          });
        });

        describe("when a tab completes a navigation event", () => {
          it("clears the set of valid auto-submit hosts", () => {
            autoSubmitLoginBackground["validAutoSubmitHosts"].add(validIpdUrl1);

            triggerWebNavigationOnCompletedEvent(
              mock<chrome.webNavigation.WebNavigationFramedCallbackDetails>({
                tabId: newTabId,
                url: validIpdUrl2,
                frameId: 0,
              }),
            );

            expect(autoSubmitLoginBackground["validAutoSubmitHosts"].size).toBe(0);
          });

          it("updates the most recent idp host", () => {
            triggerWebNavigationOnCompletedEvent(
              mock<chrome.webNavigation.WebNavigationFramedCallbackDetails>({
                tabId: newTabId,
                url: validIpdUrl2,
                frameId: 0,
              }),
            );

            expect(autoSubmitLoginBackground["mostRecentIdpHost"]).toStrictEqual({
              url: validIpdUrl2,
              tabId: newTabId,
            });
          });

          it("clears the auto submit host data if the tab is removed or closed", () => {
            triggerWebNavigationOnCompletedEvent(
              mock<chrome.webNavigation.WebNavigationFramedCallbackDetails>({
                tabId: newTabId,
                url: validIpdUrl2,
                frameId: 0,
              }),
            );
            autoSubmitLoginBackground["currentAutoSubmitHostData"] = {
              url: validIpdUrl2,
              tabId: newTabId,
            };

            triggerTabOnRemovedEvent(newTabId, mock<chrome.tabs.TabRemoveInfo>());

            expect(autoSubmitLoginBackground["currentAutoSubmitHostData"]).toStrictEqual({});
          });
        });
      });

      it("allows the route to trigger auto-submit after a chain redirection to a valid auto-submit URL is made", async () => {
        await autoSubmitLoginBackground.init();
        autoSubmitLoginBackground["mostRecentIdpHost"] = {
          url: validIpdUrl1,
          tabId: tabId,
        };
        triggerWebRequestOnBeforeRedirectEvent(
          mock<chrome.webRequest.WebRedirectionResponseDetails>({
            url: validIpdUrl1,
            redirectUrl: validIpdUrl2,
            frameId: 0,
          }),
        );
        triggerWebRequestOnBeforeRedirectEvent(
          mock<chrome.webRequest.WebRedirectionResponseDetails>({
            url: validIpdUrl2,
            redirectUrl: validAutoSubmitUrl,
            frameId: 0,
          }),
        );

        triggerWebRequestOnBeforeRequestEvent(
          mock<chrome.webRequest.WebRequestBodyDetails>({
            tabId: tabId,
            url: `https://${validAutoSubmitHost}`,
            initiator: null,
            frameId: 0,
          }),
        );

        expect(chrome.webNavigation.onCompleted.addListener).toBeCalledWith(expect.any(Function), {
          url: [{ hostEquals: validAutoSubmitHost }],
        });
      });
    });

    describe("extension message listeners", () => {
      let sender: chrome.runtime.MessageSender;

      beforeEach(async () => {
        await autoSubmitLoginBackground.init();
        autoSubmitLoginBackground["validAutoSubmitHosts"].add(validAutoSubmitHost);
        autoSubmitLoginBackground["currentAutoSubmitHostData"] = {
          url: validAutoSubmitUrl,
          tabId: 1,
        };
        sender = mock<chrome.runtime.MessageSender>({
          tab: mock<chrome.tabs.Tab>({ id: 1 }),
          frameId: 0,
          url: validAutoSubmitUrl,
        });
      });

      it("skips acting on messages that do not come from the current auto-fill workflow's tab", () => {
        sender.tab = mock<chrome.tabs.Tab>({ id: 2 });

        sendMockExtensionMessage({ command: "triggerAutoSubmitLogin" }, sender);

        // FIXME: Remove when updating file. Eslint update
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        expect(autofillService.doAutoFillOnTab).not.toHaveBeenCalled;
      });

      it("skips acting on messages whose command does not have a registered handler", () => {
        sendMockExtensionMessage({ command: "someInvalidCommand" }, sender);

        // FIXME: Remove when updating file. Eslint update
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        expect(autofillService.doAutoFillOnTab).not.toHaveBeenCalled;
      });

      describe("triggerAutoSubmitLogin extension message", () => {
        it("triggers an autofill action with auto-submission on the sender of the message", async () => {
          const message = {
            command: "triggerAutoSubmitLogin",
            pageDetails: mock<AutofillPageDetails>(),
          };

          sendMockExtensionMessage(message, sender);
          await flushPromises();

          expect(autofillService.doAutoFillOnTab).toBeCalledWith(
            [
              {
                frameId: sender.frameId,
                tab: sender.tab,
                details: message.pageDetails,
              },
            ],
            sender.tab,
            true,
            true,
          );
        });
      });

      describe("multiStepAutoSubmitLoginComplete extension message", () => {
        it("removes the sender URL from the set of valid auto-submit hosts", () => {
          const message = { command: "multiStepAutoSubmitLoginComplete" };

          sendMockExtensionMessage(message, sender);

          expect(autoSubmitLoginBackground["validAutoSubmitHosts"].has(validAutoSubmitHost)).toBe(
            false,
          );
        });
      });
    });
  });
});
