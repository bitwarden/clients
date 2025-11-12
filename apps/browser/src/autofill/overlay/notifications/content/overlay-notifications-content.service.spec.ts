import { mock, MockProxy } from "jest-mock-extended";

import AutofillInit from "../../../content/autofill-init";
import { NotificationType } from "../../../enums/notification-type.enum";
import { DomQueryService } from "../../../services/abstractions/dom-query.service";
import DomElementVisibilityService from "../../../services/dom-element-visibility.service";
import { flushPromises, sendMockExtensionMessage } from "../../../spec/testing-utils";
import * as utils from "../../../utils";
import { NotificationTypeData } from "../abstractions/overlay-notifications-content.service";

import { OverlayNotificationsContentService } from "./overlay-notifications-content.service";

describe("OverlayNotificationsContentService", () => {
  let overlayNotificationsContentService: OverlayNotificationsContentService;
  let domQueryService: MockProxy<DomQueryService>;
  let domElementVisibilityService: DomElementVisibilityService;
  let autofillInit: AutofillInit;
  let bodyAppendChildSpy: jest.SpyInstance;
  let postMessageSpy: jest.SpyInstance<void, Parameters<Window["postMessage"]>>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(utils, "sendExtensionMessage").mockImplementation(async () => null);
    jest.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockReturnValue(window);
    postMessageSpy = jest.spyOn(window, "postMessage").mockImplementation(jest.fn());
    domQueryService = mock<DomQueryService>();
    domElementVisibilityService = new DomElementVisibilityService();
    overlayNotificationsContentService = new OverlayNotificationsContentService();
    autofillInit = new AutofillInit(
      domQueryService,
      domElementVisibilityService,
      undefined,
      undefined,
      overlayNotificationsContentService,
    );
    autofillInit.init();
    bodyAppendChildSpy = jest.spyOn(globalThis.document.body, "appendChild");
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe("opening the notification bar", () => {
    it("skips opening the notification bar if the init data is not present in the message", async () => {
      sendMockExtensionMessage({ command: "openNotificationBar" });
      await flushPromises();

      expect(bodyAppendChildSpy).not.toHaveBeenCalled();
    });

    it("closes the notification bar if the notification bar type has changed", async () => {
      overlayNotificationsContentService["currentNotificationBarType"] = NotificationType.AddLogin;
      const closeNotificationBarSpy = jest.spyOn(
        overlayNotificationsContentService as any,
        "closeNotificationBar",
      );

      sendMockExtensionMessage({
        command: "openNotificationBar",
        data: {
          type: NotificationType.ChangePassword,
          typeData: mock<NotificationTypeData>(),
        },
      });
      await flushPromises();

      expect(closeNotificationBarSpy).toHaveBeenCalled();
    });

    it("creates the notification bar elements and appends them to the body within a shadow root", async () => {
      sendMockExtensionMessage({
        command: "openNotificationBar",
        data: {
          type: NotificationType.ChangePassword,
          typeData: mock<NotificationTypeData>(),
        },
      });
      await flushPromises();

      expect(overlayNotificationsContentService["notificationBarElement"]).toMatchSnapshot();

      const rootElement = overlayNotificationsContentService["notificationBarRootElement"];
      expect(bodyAppendChildSpy).toHaveBeenCalledWith(rootElement);
      expect(rootElement?.tagName).toBe("BIT-NOTIFICATION-BAR-ROOT");

      expect(document.getElementById("bit-notification-bar")).toBeNull();
      expect(document.querySelector("#bit-notification-bar-iframe")).toBeNull();
    });

    it("sets up a slide in animation when the notification is fresh", async () => {
      sendMockExtensionMessage({
        command: "openNotificationBar",
        data: {
          type: NotificationType.ChangePassword,
          typeData: mock<NotificationTypeData>({
            launchTimestamp: Date.now(),
          }),
        },
      });
      await flushPromises();

      expect(
        overlayNotificationsContentService["notificationBarIframeElement"]?.style.transform,
      ).toBe("translateX(100%)");
    });

    it("triggers the iframe animation on load of the element", async () => {
      sendMockExtensionMessage({
        command: "openNotificationBar",
        data: {
          type: NotificationType.ChangePassword,
          typeData: mock<NotificationTypeData>(),
        },
      });
      await flushPromises();

      overlayNotificationsContentService["notificationBarIframeElement"]?.dispatchEvent(
        new Event("load"),
      );

      expect(
        overlayNotificationsContentService["notificationBarIframeElement"]?.style.transform,
      ).toBe("translateX(0)");
    });

    it("sends an initialization message to the notification bar iframe", async () => {
      const addEventListenerSpy = jest.spyOn(globalThis, "addEventListener");

      sendMockExtensionMessage({
        command: "openNotificationBar",
        data: {
          type: NotificationType.ChangePassword,
          typeData: mock<NotificationTypeData>(),
        },
      });
      await flushPromises();
      expect(addEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function));

      globalThis.dispatchEvent(
        new MessageEvent("message", {
          data: { command: "someOtherMessage" },
        }),
      );
      globalThis.dispatchEvent(
        new MessageEvent("message", {
          data: { command: "initNotificationBar" },
          source: overlayNotificationsContentService["notificationBarIframeElement"]?.contentWindow,
        }),
      );
      await flushPromises();

      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          command: "initNotificationBar",
          initData: expect.any(Object),
        },
        "*",
      );
    });
  });

  describe("closing the notification bar", () => {
    beforeEach(async () => {
      sendMockExtensionMessage({
        command: "openNotificationBar",
        data: {
          type: NotificationType.ChangePassword,
          typeData: mock<NotificationTypeData>(),
        },
      });
      await flushPromises();
    });

    it("triggers a fadeout of the notification bar", () => {
      sendMockExtensionMessage({
        command: "closeNotificationBar",
        data: { fadeOutNotification: true },
      });

      expect(
        overlayNotificationsContentService["notificationBarIframeElement"]?.style.opacity,
      ).toBe("0");

      jest.advanceTimersByTime(150);
    });

    it("triggers a fadeout of the notification bar and removes from the notification queue", () => {
      sendMockExtensionMessage({
        command: "closeNotificationBar",
        data: { fadeOutNotification: true, type: NotificationType.ChangePassword },
      });

      expect(
        overlayNotificationsContentService["notificationBarIframeElement"]?.style.opacity,
      ).toBe("0");

      jest.advanceTimersByTime(150);

      expect(utils.sendExtensionMessage).toHaveBeenCalledWith("bgRemoveTabFromNotificationQueue");
    });

    it("closes the notification bar without a fadeout", () => {
      jest.spyOn(globalThis, "setTimeout");
      sendMockExtensionMessage({
        command: "closeNotificationBar",
        data: { fadeOutNotification: false },
      });

      expect(globalThis.setTimeout).not.toHaveBeenCalled();
      expect(overlayNotificationsContentService["notificationBarIframeElement"]).toBeNull();
    });
  });

  describe("adjusting the notification bar's height", () => {
    beforeEach(async () => {
      sendMockExtensionMessage({
        command: "openNotificationBar",
        data: {
          type: NotificationType.ChangePassword,
          typeData: mock<NotificationTypeData>(),
        },
      });
      await flushPromises();
    });

    it("adjusts the height of the notification bar", () => {
      sendMockExtensionMessage({
        command: "adjustNotificationBar",
        data: { height: 1000 },
      });

      expect(overlayNotificationsContentService["notificationBarElement"]?.style.height).toBe(
        "1000px",
      );
    });
  });

  describe("when a save cipher attempt is completed", () => {
    beforeEach(async () => {
      sendMockExtensionMessage({
        command: "openNotificationBar",
        data: {
          type: NotificationType.ChangePassword,
          typeData: mock<NotificationTypeData>(),
        },
      });
      await flushPromises();
    });

    it("sends a message to the notification bar iframe indicating that the save attempt completed", () => {
      sendMockExtensionMessage({
        command: "saveCipherAttemptCompleted",
        data: { error: undefined },
      });

      expect(postMessageSpy).toHaveBeenCalledWith(
        { command: "saveCipherAttemptCompleted", error: undefined },
        "*",
      );
    });
  });

  describe("destroy", () => {
    beforeEach(async () => {
      sendMockExtensionMessage({
        command: "openNotificationBar",
        data: {
          type: NotificationType.ChangePassword,
          typeData: mock<NotificationTypeData>(),
        },
      });
      await flushPromises();
    });

    it("triggers a closure of the notification bar and cleans up all shadow DOM elements", () => {
      overlayNotificationsContentService.destroy();

      expect(overlayNotificationsContentService["notificationBarRootElement"]).toBeNull();
      expect(overlayNotificationsContentService["notificationBarElement"]).toBeNull();
      expect(overlayNotificationsContentService["notificationBarIframeElement"]).toBeNull();
    });
  });
});
