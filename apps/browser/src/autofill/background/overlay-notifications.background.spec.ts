import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { CLEAR_NOTIFICATION_LOGIN_DATA_DURATION } from "@bitwarden/common/autofill/constants";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ServerConfig } from "@bitwarden/common/platform/abstractions/config/server-config";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { EnvironmentServerConfigData } from "@bitwarden/common/platform/models/data/server-config.data";

import { BrowserApi } from "../../platform/browser/browser-api";
import AutofillField from "../models/autofill-field";
import AutofillPageDetails from "../models/autofill-page-details";
import {
  flushPromises,
  sendMockExtensionMessage,
  triggerTabOnRemovedEvent,
  triggerTabOnUpdatedEvent,
  triggerWebNavigationOnCompletedEvent,
  triggerWebRequestOnBeforeRequestEvent,
  triggerWebRequestOnCompletedEvent,
} from "../spec/testing-utils";

import NotificationBackground from "./notification.background";
import { OverlayNotificationsBackground } from "./overlay-notifications.background";

describe("OverlayNotificationsBackground", () => {
  let logService: MockProxy<LogService>;
  let getFeatureFlagMock$: BehaviorSubject<boolean>;
  let configService: MockProxy<ConfigService>;
  let notificationBackground: NotificationBackground;
  let getEnableChangedPasswordPromptSpy: jest.SpyInstance;
  let getEnableAddedLoginPromptSpy: jest.SpyInstance;
  let overlayNotificationsBackground: OverlayNotificationsBackground;

  beforeEach(async () => {
    jest.useFakeTimers();
    logService = mock<LogService>();
    getFeatureFlagMock$ = new BehaviorSubject(true);
    configService = mock<ConfigService>({
      getFeatureFlag$: jest.fn().mockReturnValue(getFeatureFlagMock$),
    });
    notificationBackground = mock<NotificationBackground>();
    getEnableChangedPasswordPromptSpy = jest
      .spyOn(notificationBackground, "getEnableChangedPasswordPrompt")
      .mockResolvedValue(true);
    getEnableAddedLoginPromptSpy = jest
      .spyOn(notificationBackground, "getEnableAddedLoginPrompt")
      .mockResolvedValue(true);
    overlayNotificationsBackground = new OverlayNotificationsBackground(
      logService,
      configService,
      notificationBackground,
    );
    configService.getFeatureFlag.mockResolvedValue(true);
    await overlayNotificationsBackground.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe("feature flag behavior", () => {
    let runtimeRemoveListenerSpy: jest.SpyInstance;

    beforeEach(() => {
      runtimeRemoveListenerSpy = jest.spyOn(chrome.runtime.onMessage, "removeListener");
    });

    it("removes the extension listeners if the current flag value is set to `false`", () => {
      getFeatureFlagMock$.next(false);

      expect(runtimeRemoveListenerSpy).toHaveBeenCalled();
    });

    it("ignores the feature flag change if the previous flag value is equal to the current flag value", () => {
      getFeatureFlagMock$.next(false);
      getFeatureFlagMock$.next(false);

      expect(runtimeRemoveListenerSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("setting up the form submission listeners", () => {
    let fields: MockProxy<AutofillField>[];
    let details: MockProxy<AutofillPageDetails>;

    beforeEach(() => {
      fields = [mock<AutofillField>(), mock<AutofillField>(), mock<AutofillField>()];
      details = mock<AutofillPageDetails>({ fields });
    });

    describe("skipping setting up the web request listeners", () => {
      it("skips setting up listeners when the notification bar is disabled", async () => {
        getEnableChangedPasswordPromptSpy.mockResolvedValue(false);
        getEnableAddedLoginPromptSpy.mockResolvedValue(false);

        sendMockExtensionMessage({
          command: "collectPageDetailsResponse",
          details,
        });
        await flushPromises();

        expect(chrome.webRequest.onCompleted.addListener).not.toHaveBeenCalled();
      });

      describe("when the sender is from an excluded domain", () => {
        const senderHost = "example.com";
        const senderUrl = `https://${senderHost}`;

        beforeEach(() => {
          jest.spyOn(notificationBackground, "getExcludedDomains").mockResolvedValue({
            [senderHost]: null,
          });
        });

        it("skips setting up listeners when the sender is the user's vault", async () => {
          const vault = "https://vault.bitwarden.com";
          const sender = mock<chrome.runtime.MessageSender>({ origin: vault });
          jest
            .spyOn(notificationBackground, "getActiveUserServerConfig")
            .mockResolvedValue(
              mock<ServerConfig>({ environment: mock<EnvironmentServerConfigData>({ vault }) }),
            );

          sendMockExtensionMessage({ command: "collectPageDetailsResponse", details }, sender);
          await flushPromises();

          expect(chrome.webRequest.onCompleted.addListener).not.toHaveBeenCalled();
        });

        it("skips setting up listeners when the sender is an excluded domain", async () => {
          const sender = mock<chrome.runtime.MessageSender>({ origin: senderUrl });

          sendMockExtensionMessage({ command: "collectPageDetailsResponse", details }, sender);
          await flushPromises();

          expect(chrome.webRequest.onCompleted.addListener).not.toHaveBeenCalled();
        });

        it("skips setting up listeners when the sender contains a malformed origin", async () => {
          const senderOrigin = "-_-!..exampwle.com";
          const sender = mock<chrome.runtime.MessageSender>({ origin: senderOrigin });

          sendMockExtensionMessage({ command: "collectPageDetailsResponse", details }, sender);
          await flushPromises();

          expect(chrome.webRequest.onCompleted.addListener).not.toHaveBeenCalled();
        });
      });

      it("skips setting up listeners when the sender tab does not contain page details fields", async () => {
        const sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });
        details.fields = [];

        sendMockExtensionMessage({ command: "collectPageDetailsResponse", details }, sender);
        await flushPromises();

        expect(chrome.webRequest.onCompleted.addListener).not.toHaveBeenCalled();
      });
    });

    it("sets up the web request listeners", async () => {
      const sender = mock<chrome.runtime.MessageSender>({
        tab: { id: 1 },
        url: "example.com",
      });

      sendMockExtensionMessage({ command: "collectPageDetailsResponse", details }, sender);
      await flushPromises();

      expect(chrome.webRequest.onCompleted.addListener).toHaveBeenCalled();
    });

    it("skips setting up duplicate listeners when the website origin has been previously encountered with fields", async () => {
      const sender = mock<chrome.runtime.MessageSender>({
        tab: { id: 1 },
        url: "example.com",
      });

      sendMockExtensionMessage({ command: "collectPageDetailsResponse", details }, sender);
      await flushPromises();
      sendMockExtensionMessage({ command: "collectPageDetailsResponse", details }, sender);
      await flushPromises();
      sendMockExtensionMessage({ command: "collectPageDetailsResponse", details }, sender);
      await flushPromises();

      expect(chrome.webRequest.onCompleted.addListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("storing the modified login form data", () => {
    const pageDetails = mock<AutofillPageDetails>({ fields: [mock<AutofillField>()] });
    const sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });

    beforeEach(async () => {
      sendMockExtensionMessage(
        { command: "collectPageDetailsResponse", details: pageDetails },
        sender,
      );
      await flushPromises();
    });

    it("ignores the store request if the sender is not within the website origins set", () => {
      sendMockExtensionMessage(
        {
          command: "formFieldSubmitted",
          uri: "example.com",
          username: "username",
          password: "password",
          newPassword: "newPassword",
        },
        mock<chrome.runtime.MessageSender>({ tab: { id: 2 } }),
      );

      expect(
        overlayNotificationsBackground["modifyLoginCipherFormData"].get(sender.tab.id),
      ).toBeUndefined();
    });

    it("ignores the store request if the form submission does not include a username, password, or newPassword", () => {
      sendMockExtensionMessage(
        {
          command: "formFieldSubmitted",
          uri: "example.com",
          username: "",
          password: "",
          newPassword: "",
        },
        sender,
      );

      expect(
        overlayNotificationsBackground["modifyLoginCipherFormData"].get(sender.tab.id),
      ).toBeUndefined();
    });

    it("stores the modified login cipher form data", async () => {
      sendMockExtensionMessage(
        {
          command: "formFieldSubmitted",
          uri: "example.com",
          username: "username",
          password: "password",
          newPassword: "newPassword",
        },
        sender,
      );
      await flushPromises();

      expect(
        overlayNotificationsBackground["modifyLoginCipherFormData"].get(sender.tab.id),
      ).toEqual({
        uri: "example.com",
        username: "username",
        password: "password",
        newPassword: "newPassword",
      });
    });

    it("overrides previously stored modified login cipher form data with a subsequent store request", async () => {
      sendMockExtensionMessage(
        {
          command: "formFieldSubmitted",
          uri: "example.com",
          username: "oldUsername",
          password: "oldPassword",
          newPassword: "oldNewPassword",
        },
        sender,
      );
      await flushPromises();

      sendMockExtensionMessage(
        {
          command: "formFieldSubmitted",
          uri: "example.com",
          username: "username",
          password: "",
          newPassword: "",
        },
        sender,
      );
      await flushPromises();

      expect(
        overlayNotificationsBackground["modifyLoginCipherFormData"].get(sender.tab.id),
      ).toEqual({
        uri: "example.com",
        username: "username",
        password: "oldPassword",
        newPassword: "oldNewPassword",
      });
    });

    it("clears the modified login cipher form data after 5 seconds", () => {
      sendMockExtensionMessage(
        {
          command: "formFieldSubmitted",
          uri: "example.com",
          username: "username",
          password: "password",
          newPassword: "newPassword",
        },
        sender,
      );

      jest.advanceTimersByTime(CLEAR_NOTIFICATION_LOGIN_DATA_DURATION);

      expect(overlayNotificationsBackground["modifyLoginCipherFormData"].size).toBe(0);
    });

    it("attempts to store the modified login cipher form data within the onBeforeRequest listener when the data is not captured through a submit button click event", async () => {
      const pageDetails = mock<AutofillPageDetails>({ fields: [mock<AutofillField>()] });
      const tab = mock<chrome.tabs.Tab>({ id: sender.tab.id });
      jest.spyOn(BrowserApi, "getTab").mockResolvedValueOnce(tab);
      const response = {
        command: "formFieldSubmitted",
        uri: "example.com",
        username: "username",
        password: "password",
        newPassword: "newPassword",
      };
      jest.spyOn(BrowserApi, "tabSendMessage").mockResolvedValueOnce(response);
      sendMockExtensionMessage(
        { command: "collectPageDetailsResponse", details: pageDetails },
        sender,
      );
      await flushPromises();

      triggerWebRequestOnBeforeRequestEvent(
        mock<chrome.webRequest.WebRequestDetails>({
          url: "https://example.com",
          tabId: sender.tab.id,
          method: "POST",
          requestId: "123345",
        }),
      );
      await flushPromises();

      expect(
        overlayNotificationsBackground["modifyLoginCipherFormData"].get(sender.tab.id),
      ).toEqual({
        uri: "example.com",
        username: "username",
        password: "password",
        newPassword: "newPassword",
      });
    });
  });

  describe("web request listeners", () => {
    let sender: MockProxy<chrome.runtime.MessageSender>;
    const pageDetails = mock<AutofillPageDetails>({ fields: [mock<AutofillField>()] });
    let notificationChangedPasswordSpy: jest.SpyInstance;
    let notificationAddLoginSpy: jest.SpyInstance;

    beforeEach(async () => {
      sender = mock<chrome.runtime.MessageSender>({
        tab: { id: 1 },
        url: "https://example.com",
      });
      notificationChangedPasswordSpy = jest.spyOn(notificationBackground, "changedPassword");
      notificationAddLoginSpy = jest.spyOn(notificationBackground, "addLogin");

      sendMockExtensionMessage(
        { command: "collectPageDetailsResponse", details: pageDetails },
        sender,
      );
      await flushPromises();
    });

    describe("ignored web requests", () => {
      it("ignores requests from urls that do not start with a valid protocol", async () => {
        sender.url = "chrome-extension://extension-id";

        triggerWebRequestOnBeforeRequestEvent(
          mock<chrome.webRequest.WebRequestDetails>({
            url: sender.url,
            tabId: sender.tab.id,
            method: "POST",
          }),
        );

        expect(overlayNotificationsBackground["activeFormSubmissionRequests"].size).toBe(0);
      });

      it("ignores requests from urls that do not have a valid tabId", async () => {
        sender.tab = mock<chrome.tabs.Tab>({ id: -1 });

        triggerWebRequestOnBeforeRequestEvent(
          mock<chrome.webRequest.WebRequestDetails>({
            url: sender.url,
            tabId: sender.tab.id,
            method: "POST",
          }),
        );

        expect(overlayNotificationsBackground["activeFormSubmissionRequests"].size).toBe(0);
      });

      it("ignores requests from urls that do not have a valid request method", async () => {
        triggerWebRequestOnBeforeRequestEvent(
          mock<chrome.webRequest.WebRequestDetails>({
            url: sender.url,
            tabId: sender.tab.id,
            method: "GET",
          }),
        );

        expect(overlayNotificationsBackground["activeFormSubmissionRequests"].size).toBe(0);
      });

      it("ignores requests that are not part of an active form submission", async () => {
        triggerWebRequestOnCompletedEvent(
          mock<chrome.webRequest.WebResponseDetails>({
            url: sender.url,
            tabId: sender.tab.id,
            requestId: "123345",
          }),
        );

        expect(notificationChangedPasswordSpy).not.toHaveBeenCalled();
        expect(notificationAddLoginSpy).not.toHaveBeenCalled();
      });

      it("ignores requests for tabs that do not contain stored login data", async () => {
        const requestId = "123345";
        triggerWebRequestOnBeforeRequestEvent(
          mock<chrome.webRequest.WebRequestDetails>({
            url: sender.url,
            tabId: sender.tab.id,
            method: "POST",
            requestId,
          }),
        );
        await flushPromises();

        triggerWebRequestOnCompletedEvent(
          mock<chrome.webRequest.WebResponseDetails>({
            url: sender.url,
            tabId: sender.tab.id,
            requestId,
          }),
        );

        expect(notificationChangedPasswordSpy).not.toHaveBeenCalled();
        expect(notificationAddLoginSpy).not.toHaveBeenCalled();
      });

      it("clears the notification fallback timeout if the request is completed with an invalid status code", async () => {
        const clearFallbackSpy = jest.spyOn(
          overlayNotificationsBackground as any,
          "clearNotificationFallbackTimeout",
        );

        const requestId = "123345";
        triggerWebRequestOnBeforeRequestEvent(
          mock<chrome.webRequest.WebRequestDetails>({
            url: sender.url,
            tabId: sender.tab.id,
            method: "POST",
            requestId,
          }),
        );
        await flushPromises();

        triggerWebRequestOnCompletedEvent(
          mock<chrome.webRequest.WebResponseDetails>({
            url: sender.url,
            tabId: sender.tab.id,
            statusCode: 404,
            requestId,
          }),
        );
        await flushPromises();

        expect(clearFallbackSpy).toHaveBeenCalled();
      });
    });

    describe("web requests that trigger notifications", () => {
      const requestId = "123345";
      const pageDetails = mock<AutofillPageDetails>({ fields: [mock<AutofillField>()] });

      beforeEach(async () => {
        sendMockExtensionMessage(
          { command: "collectPageDetailsResponse", details: pageDetails },
          sender,
        );
        await flushPromises();
        sendMockExtensionMessage(
          {
            command: "formFieldSubmitted",
            uri: "example.com",
            username: "username",
            password: "password",
            newPassword: "newPassword",
          },
          sender,
        );
        triggerWebRequestOnBeforeRequestEvent(
          mock<chrome.webRequest.WebRequestDetails>({
            url: sender.url,
            tabId: sender.tab.id,
            method: "POST",
            requestId,
          }),
        );
        await flushPromises();
      });

      it("waits for the tab's navigation to complete using the web navigation API before initializing the notification", async () => {
        chrome.tabs.get = jest.fn().mockImplementationOnce((tabId, callback) => {
          callback(
            mock<chrome.tabs.Tab>({
              status: "loading",
              url: sender.url,
            }),
          );
        });
        triggerWebRequestOnCompletedEvent(
          mock<chrome.webRequest.WebResponseDetails>({
            url: sender.url,
            tabId: sender.tab.id,
            requestId,
          }),
        );
        await flushPromises();

        chrome.tabs.get = jest.fn().mockImplementationOnce((tabId, callback) => {
          callback(
            mock<chrome.tabs.Tab>({
              status: "complete",
              url: sender.url,
            }),
          );
        });
        triggerWebNavigationOnCompletedEvent(
          mock<chrome.webNavigation.WebNavigationFramedCallbackDetails>({
            tabId: sender.tab.id,
            url: sender.url,
          }),
        );
        await flushPromises();

        expect(notificationAddLoginSpy).toHaveBeenCalled();
      });

      it("initializes the notification immediately when the tab's navigation is complete", async () => {
        sendMockExtensionMessage(
          {
            command: "formFieldSubmitted",
            uri: "example.com",
            username: "username",
            password: "password",
            newPassword: "newPassword",
          },
          sender,
        );
        await flushPromises();
        chrome.tabs.get = jest.fn().mockImplementationOnce((tabId, callback) => {
          callback(
            mock<chrome.tabs.Tab>({
              status: "complete",
              url: sender.url,
            }),
          );
        });

        triggerWebRequestOnCompletedEvent(
          mock<chrome.webRequest.WebResponseDetails>({
            url: sender.url,
            tabId: sender.tab.id,
            requestId,
          }),
        );
        await flushPromises();

        expect(notificationAddLoginSpy).toHaveBeenCalled();
      });

      it("triggers the notification on the beforeRequest listener when a post-submission redirection is encountered", async () => {
        sender.tab = mock<chrome.tabs.Tab>({ id: 4 });
        sendMockExtensionMessage(
          { command: "collectPageDetailsResponse", details: pageDetails },
          sender,
        );
        await flushPromises();
        sendMockExtensionMessage(
          {
            command: "formFieldSubmitted",
            uri: "example.com",
            username: "",
            password: "password",
            newPassword: "newPassword",
          },
          sender,
        );
        await flushPromises();
        chrome.tabs.get = jest.fn().mockImplementation((tabId, callback) => {
          callback(
            mock<chrome.tabs.Tab>({
              status: "complete",
              url: sender.url,
            }),
          );
        });

        triggerWebRequestOnBeforeRequestEvent(
          mock<chrome.webRequest.WebRequestDetails>({
            url: sender.url,
            tabId: sender.tab.id,
            method: "POST",
            requestId,
          }),
        );
        await flushPromises();

        triggerWebRequestOnBeforeRequestEvent(
          mock<chrome.webRequest.WebRequestDetails>({
            url: "https://example.com/redirect",
            tabId: sender.tab.id,
            method: "GET",
            requestId,
          }),
        );
        await flushPromises();

        expect(notificationChangedPasswordSpy).toHaveBeenCalled();
      });
    });
  });

  describe("tab listeners", () => {
    let sender: MockProxy<chrome.runtime.MessageSender>;
    const pageDetails = mock<AutofillPageDetails>({ fields: [mock<AutofillField>()] });
    const requestId = "123345";

    beforeEach(async () => {
      sender = mock<chrome.runtime.MessageSender>({
        tab: { id: 1 },
        url: "https://example.com",
      });

      sendMockExtensionMessage(
        { command: "collectPageDetailsResponse", details: pageDetails },
        sender,
      );
      await flushPromises();
      triggerWebRequestOnBeforeRequestEvent(
        mock<chrome.webRequest.WebRequestDetails>({
          url: sender.url,
          tabId: sender.tab.id,
          method: "POST",
          requestId,
        }),
      );
      await flushPromises();
      sendMockExtensionMessage(
        {
          command: "formFieldSubmitted",
          uri: "example.com",
          username: "username",
          password: "password",
          newPassword: "newPassword",
        },
        sender,
      );
      await flushPromises();
    });

    it("clears all associated data with a removed tab", () => {
      triggerTabOnRemovedEvent(sender.tab.id, mock<chrome.tabs.TabRemoveInfo>());

      expect(overlayNotificationsBackground["websiteOriginsWithFields"].size).toBe(0);
    });

    describe("tab onUpdated", () => {
      it("skips clearing the website origins if the changeInfo does not contain a `loading` status", () => {
        triggerTabOnUpdatedEvent(
          sender.tab.id,
          mock<chrome.tabs.TabChangeInfo>({ status: "complete" }),
          mock<chrome.tabs.Tab>({ status: "complete" }),
        );

        expect(overlayNotificationsBackground["websiteOriginsWithFields"].size).toBe(1);
      });

      it("skips clearing the website origins if the changeInfo does not contain a url", () => {
        triggerTabOnUpdatedEvent(
          sender.tab.id,
          mock<chrome.tabs.TabChangeInfo>({ status: "loading", url: "" }),
          mock<chrome.tabs.Tab>({ status: "loading" }),
        );

        expect(overlayNotificationsBackground["websiteOriginsWithFields"].size).toBe(1);
      });

      it("skips clearing the website origins if the tab does not contain known website origins", () => {
        triggerTabOnUpdatedEvent(
          199,
          mock<chrome.tabs.TabChangeInfo>({ status: "loading", url: "https://example.com" }),
          mock<chrome.tabs.Tab>({ status: "loading", id: 199 }),
        );

        expect(overlayNotificationsBackground["websiteOriginsWithFields"].size).toBe(1);
      });

      it("skips clearing the website origins if the changeInfo's url is present as part of the know website origin match patterns", () => {
        triggerTabOnUpdatedEvent(
          sender.tab.id,
          mock<chrome.tabs.TabChangeInfo>({
            status: "loading",
            url: "https://subdomain.example.com",
          }),
          mock<chrome.tabs.Tab>({ status: "loading" }),
        );

        expect(overlayNotificationsBackground["websiteOriginsWithFields"].size).toBe(1);
      });

      it("clears all associated data with a tab that is entering a `loading` state", () => {
        triggerTabOnUpdatedEvent(
          sender.tab.id,
          mock<chrome.tabs.TabChangeInfo>({ status: "loading" }),
          mock<chrome.tabs.Tab>({ status: "loading" }),
        );

        expect(overlayNotificationsBackground["websiteOriginsWithFields"].size).toBe(0);
      });
    });
  });
});
