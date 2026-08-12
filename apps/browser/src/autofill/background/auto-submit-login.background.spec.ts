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
import {
  AutofillLifecycleService,
  AutomationWorkflow,
} from "../services/abstractions/autofill-lifecycle.service";
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
  let autofillLifecycleService: MockProxy<AutofillLifecycleService>;
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
    autofillLifecycleService = mock<AutofillLifecycleService>();
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
      autofillLifecycleService,
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
    let webRequestDetails: chrome.webRequest.WebRequestDetails;

    describe("starting the auto-submit login workflow", () => {
      beforeEach(async () => {
        webRequestDetails = mock<chrome.webRequest.WebRequestDetails>({
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
        expect(chrome.webNavigation.onCompleted.addListener).toHaveBeenCalledWith(
          expect.any(Function),
          {
            url: [{ hostEquals: validAutoSubmitHost }],
          },
        );
      });

      it("sets up the auto-submit workflow when the web request occurs in a sub frame and the initiator of the request is a valid auto-submit host", async () => {
        const topFrameHost = "some-top-frame.com";
        const subFrameHost = "some-sub-frame.com";
        autoSubmitLoginBackground["validAutoSubmitHosts"].add(topFrameHost);
        webRequestDetails.type = "sub_frame";
        webRequestDetails.initiator = `https://${topFrameHost}`;
        webRequestDetails.url = `https://${subFrameHost}`;

        triggerWebRequestOnBeforeRequestEvent(webRequestDetails);

        expect(chrome.webNavigation.onCompleted.addListener).toHaveBeenCalledWith(
          expect.any(Function),
          {
            url: [{ hostEquals: subFrameHost }],
          },
        );
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

          expect(scriptInjectorService.inject).toHaveBeenCalledWith({
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
        webRequestDetails = mock<chrome.webRequest.WebRequestDetails>({
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

      it("properly cleans up auto-submit workflows when requestInitiator is falsy but active auto-submit hosts exist", async () => {
        webRequestDetails.initiator = undefined;
        jest
          .spyOn(BrowserApi, "getTab")
          .mockResolvedValue(mock<chrome.tabs.Tab>({ url: validAutoSubmitUrl, id: 1 }));

        triggerWebRequestOnBeforeRequestEvent(webRequestDetails);
        await flushPromises();

        expect(autoSubmitLoginBackground["validAutoSubmitHosts"].has(validAutoSubmitHost)).toBe(
          false,
        );
      });
    });

    describe("reporting auto-submit invalidation to the lifecycle", () => {
      beforeEach(async () => {
        webRequestDetails = mock<chrome.webRequest.WebRequestDetails>({
          initiator: validIpdUrl1,
          url: validAutoSubmitUrl,
          type: "main_frame",
          tabId: 5,
        });
        await autoSubmitLoginBackground.init();
        autoSubmitLoginBackground["currentAutoSubmitHostData"] = {
          url: validAutoSubmitUrl,
          tabId: 1,
        };
        autoSubmitLoginBackground["validAutoSubmitHosts"].add(validAutoSubmitHost);
      });

      it("reports a whole-flow invalidation keyed to the active flow's tab when a POST follows submission", () => {
        webRequestDetails.method = "POST";

        triggerWebRequestOnBeforeRequestEvent(webRequestDetails);

        expect(autofillLifecycleService.reportAutoSubmitInvalidated).toHaveBeenCalledWith(1);
      });

      it("reports a whole-flow invalidation when a redirection to an invalid host is made", () => {
        webRequestDetails.url = "https://invalid-host.com";

        triggerWebRequestOnBeforeRequestEvent(webRequestDetails);

        expect(autofillLifecycleService.reportAutoSubmitInvalidated).toHaveBeenCalledWith(1);
      });

      it("reports a single-host invalidation keyed to the request's tab when a valid host navigates away", () => {
        webRequestDetails.url = `https://${validAutoSubmitHost}`;
        webRequestDetails.initiator = `https://${validAutoSubmitHost}#autosubmit=1`;

        triggerWebRequestOnBeforeRequestEvent(webRequestDetails);

        expect(autofillLifecycleService.reportAutoSubmitInvalidated).toHaveBeenCalledWith(
          webRequestDetails.tabId,
          validAutoSubmitHost,
        );
      });

      it("reports a single-host invalidation keyed to the request's tab when an internal navigation is detected via the tab URL", async () => {
        webRequestDetails.url = `https://${validAutoSubmitHost}/some-other-route`;
        jest
          .spyOn(BrowserApi, "getTab")
          .mockResolvedValue(mock<chrome.tabs.Tab>({ url: validAutoSubmitHost }));

        triggerWebRequestOnBeforeRequestEvent(webRequestDetails);
        await flushPromises();

        expect(autofillLifecycleService.reportAutoSubmitInvalidated).toHaveBeenCalledWith(
          webRequestDetails.tabId,
          validAutoSubmitHost,
        );
      });

      it("does not report an invalidation when removing a host that was never a member", () => {
        // Drives the single-host path directly: the public disable paths pre-check
        // membership, so a non-member removal is only reachable here. Proves the
        // `Set.delete` guard keeps the signal silent on a no-op removal.
        autoSubmitLoginBackground["invalidateAutoSubmitHost"]("https://not-a-member.example", 1);

        expect(autofillLifecycleService.reportAutoSubmitInvalidated).not.toHaveBeenCalled();
      });

      it("does not report an invalidation when tearing down an already-empty workflow", () => {
        autoSubmitLoginBackground["validAutoSubmitHosts"].clear();
        webRequestDetails.method = "POST";
        // A POST with no active hosts cannot pass the post-after-submission guard, so
        // drive the teardown directly to prove the empty-set path stays silent.
        autoSubmitLoginBackground["clearAutoSubmitHostData"]();

        expect(autofillLifecycleService.reportAutoSubmitInvalidated).not.toHaveBeenCalled();
      });
    });

    describe("when the extension is running on a Safari browser", () => {
      const tabId = 1;
      const tab = mock<chrome.tabs.Tab>({ id: tabId, url: validIpdUrl1 });

      beforeEach(() => {
        platformUtilsService.isSafari.mockReturnValue(true);
        autoSubmitLoginBackground = new AutoSubmitLoginBackground(
          logService,
          autofillLifecycleService,
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
        const webRequestDetails = mock<chrome.webRequest.WebRequestDetails>({
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

          expect(chrome.webNavigation.onCompleted.addListener).toHaveBeenCalledWith(
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

          triggerTabOnActivatedEvent(mock<chrome.tabs.OnActivatedInfo>({ tabId: newTabId }));
          await flushPromises();

          expect(autoSubmitLoginBackground["mostRecentIdpHost"]).toStrictEqual({
            url: validIpdUrl2,
            tabId: newTabId,
          });
        });

        it("updates the most recent id host when a tab is updated", () => {
          triggerTabOnUpdatedEvent(
            newTabId,
            mock<chrome.tabs.OnUpdatedInfo>({ url: validIpdUrl1 }),
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

          it("reports a whole-flow invalidation, falling back to the navigating tab when no flow tab is recorded", () => {
            autoSubmitLoginBackground["validAutoSubmitHosts"].add(validIpdUrl1);

            triggerWebNavigationOnCompletedEvent(
              mock<chrome.webNavigation.WebNavigationFramedCallbackDetails>({
                tabId: newTabId,
                url: validIpdUrl2,
                frameId: 0,
              }),
            );

            expect(autofillLifecycleService.reportAutoSubmitInvalidated).toHaveBeenCalledWith(
              newTabId,
            );
          });

          it("reports a whole-flow invalidation keyed to the recorded flow tab when one exists", () => {
            const flowTabId = 99;
            autoSubmitLoginBackground["validAutoSubmitHosts"].add(validIpdUrl1);
            autoSubmitLoginBackground["currentAutoSubmitHostData"] = {
              url: validAutoSubmitUrl,
              tabId: flowTabId,
            };

            triggerWebNavigationOnCompletedEvent(
              mock<chrome.webNavigation.WebNavigationFramedCallbackDetails>({
                tabId: newTabId,
                url: validIpdUrl2,
                frameId: 0,
              }),
            );

            expect(autofillLifecycleService.reportAutoSubmitInvalidated).toHaveBeenCalledWith(
              flowTabId,
            );
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

            triggerTabOnRemovedEvent(newTabId, mock<chrome.tabs.OnRemovedInfo>());

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
          mock<chrome.webRequest.OnBeforeRedirectDetails>({
            url: validIpdUrl1,
            redirectUrl: validIpdUrl2,
            frameId: 0,
          }),
        );
        triggerWebRequestOnBeforeRedirectEvent(
          mock<chrome.webRequest.OnBeforeRedirectDetails>({
            url: validIpdUrl2,
            redirectUrl: validAutoSubmitUrl,
            frameId: 0,
          }),
        );

        triggerWebRequestOnBeforeRequestEvent(
          mock<chrome.webRequest.WebRequestDetails>({
            tabId: tabId,
            url: `https://${validAutoSubmitHost}`,
            initiator: null,
            frameId: 0,
          }),
        );

        expect(chrome.webNavigation.onCompleted.addListener).toHaveBeenCalledWith(
          expect.any(Function),
          {
            url: [{ hostEquals: validAutoSubmitHost }],
          },
        );
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

        sendMockExtensionMessage({ command: "automatedLoginStepReady" }, sender);

        expect(autofillLifecycleService.reportAutomatedLoginStepReady).not.toHaveBeenCalled();
      });

      it("skips acting on messages whose command does not have a registered handler", () => {
        sendMockExtensionMessage({ command: "someInvalidCommand" }, sender);

        expect(autofillLifecycleService.reportAutomatedLoginStepReady).not.toHaveBeenCalled();
      });

      describe("automatedLoginStepReady extension message", () => {
        it("reports the sender's frame to the lifecycle stamped with the auto-submit workflow", async () => {
          sendMockExtensionMessage({ command: "automatedLoginStepReady" }, sender);
          await flushPromises();

          expect(autofillLifecycleService.reportAutomatedLoginStepReady).toHaveBeenCalledWith(
            sender.tab,
            sender.frameId,
            sender.url,
            AutomationWorkflow.autoSubmitLogin,
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

        it("reports the flow-complete fact to the lifecycle, carrying the sender's tab and host", () => {
          sendMockExtensionMessage({ command: "multiStepAutoSubmitLoginComplete" }, sender);

          expect(autofillLifecycleService.reportAutoSubmitFlowComplete).toHaveBeenCalledWith(
            sender.tab?.id,
            validAutoSubmitHost,
          );
        });

        it("does not report an invalidation for a completed flow", () => {
          sendMockExtensionMessage({ command: "multiStepAutoSubmitLoginComplete" }, sender);

          expect(autofillLifecycleService.reportAutoSubmitInvalidated).not.toHaveBeenCalled();
        });
      });
    });
  });
});
