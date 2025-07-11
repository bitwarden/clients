import { mock } from "jest-mock-extended";

import MainBackground from "../../background/main.background";
import {
  flushPromises,
  triggerTabOnActivatedEvent,
  triggerTabOnRemovedEvent,
  triggerTabOnReplacedEvent,
  triggerTabOnUpdatedEvent,
  triggerWindowOnFocusedChangedEvent,
} from "../spec/testing-utils";

import NotificationBackground from "./notification.background";
import { OverlayBackground } from "./overlay.background";
import TabsBackground from "./tabs.background";

describe("TabsBackground", () => {
  let tabsBackground: TabsBackground;
  const mainBackground = mock<MainBackground>({
    messagingService: {
      send: jest.fn(),
    },
  });
  const notificationBackground = mock<NotificationBackground>();
  const overlayBackground = mock<OverlayBackground>();

  beforeEach(() => {
    tabsBackground = new TabsBackground(mainBackground, notificationBackground, overlayBackground);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("init", () => {
    it("sets up a window on focusChanged listener", () => {
      const handleWindowOnFocusChangedSpy = jest.spyOn(
        tabsBackground as any,
        "handleWindowOnFocusChanged",
      );

      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      tabsBackground.init();

      expect(chrome.windows.onFocusChanged.addListener).toHaveBeenCalledWith(
        handleWindowOnFocusChangedSpy,
      );
    });
  });

  describe("tab event listeners", () => {
    beforeEach(() => {
      tabsBackground["setupTabEventListeners"]();
    });

    describe("window onFocusChanged event", () => {
      it("ignores focus change events that do not contain a windowId", async () => {
        triggerWindowOnFocusedChangedEvent(undefined);
        await flushPromises();

        expect(mainBackground.messagingService.send).not.toHaveBeenCalled();
      });

      it("sets the local focusedWindowId property", async () => {
        triggerWindowOnFocusedChangedEvent(10);
        await flushPromises();

        expect(tabsBackground["focusedWindowId"]).toBe(10);
      });

      it("updates the current tab data", async () => {
        triggerWindowOnFocusedChangedEvent(10);
        await flushPromises();

        expect(mainBackground.refreshMenu).toHaveBeenCalled();
        expect(overlayBackground.updateOverlayCiphers).toHaveBeenCalled();
      });

      it("sends a `windowChanged` message", async () => {
        triggerWindowOnFocusedChangedEvent(10);
        await flushPromises();

        expect(mainBackground.messagingService.send).toHaveBeenCalledWith("windowChanged");
      });
    });

    describe("handleTabOnActivated", () => {
      it("updates the current tab data", async () => {
        triggerTabOnActivatedEvent({ tabId: 10, windowId: 20 });
        await flushPromises();

        expect(mainBackground.refreshMenu).toHaveBeenCalled();
        expect(overlayBackground.updateOverlayCiphers).toHaveBeenCalled();
      });

      it("sends a `tabChanged` message to the messaging service", async () => {
        triggerTabOnActivatedEvent({ tabId: 10, windowId: 20 });
        await flushPromises();

        expect(mainBackground.messagingService.send).toHaveBeenCalledWith("tabChanged");
      });
    });

    describe("handleTabOnReplaced", () => {
      beforeEach(() => {
        mainBackground.onReplacedRan = false;
      });

      it("ignores the event if the `onReplacedRan` property of the main background class is set to `true`", () => {
        mainBackground.onReplacedRan = true;

        triggerTabOnReplacedEvent(10, 20);

        expect(notificationBackground.checkNotificationQueue).not.toHaveBeenCalled();
      });

      it("checks the notification queue", () => {
        triggerTabOnReplacedEvent(10, 20);

        expect(notificationBackground.checkNotificationQueue).toHaveBeenCalled();
      });

      it("updates the current tab data", async () => {
        triggerTabOnReplacedEvent(10, 20);
        await flushPromises();

        expect(mainBackground.refreshMenu).toHaveBeenCalled();
        expect(overlayBackground.updateOverlayCiphers).toHaveBeenCalled();
      });

      it("sends a `tabChanged` message to the messaging service", async () => {
        triggerTabOnReplacedEvent(10, 20);
        await flushPromises();

        expect(mainBackground.messagingService.send).toHaveBeenCalledWith("tabChanged");
      });
    });

    describe("handleTabOnUpdated", () => {
      const focusedWindowId = 10;
      let tab: chrome.tabs.Tab;

      beforeEach(() => {
        mainBackground.onUpdatedRan = false;
        mainBackground.configService.getFeatureFlag = jest.fn().mockResolvedValue(true);
        tabsBackground["focusedWindowId"] = focusedWindowId;
        tab = mock<chrome.tabs.Tab>({
          windowId: focusedWindowId,
          active: true,
          status: "loading",
        });
      });

      it("skips updating the current tab data the focusedWindowId is set to a value less than zero", async () => {
        tab.windowId = -1;
        triggerTabOnUpdatedEvent(focusedWindowId, { status: "loading" }, tab);
        await flushPromises();

        expect(mainBackground.refreshMenu).not.toHaveBeenCalled();
        expect(overlayBackground.updateOverlayCiphers).not.toHaveBeenCalled();
      });

      it("skips updating the current tab data if the updated tab is not for the focusedWindowId", async () => {
        tab.windowId = 20;
        triggerTabOnUpdatedEvent(focusedWindowId, { status: "loading" }, tab);
        await flushPromises();

        expect(mainBackground.refreshMenu).not.toHaveBeenCalled();
        expect(overlayBackground.updateOverlayCiphers).not.toHaveBeenCalled();
      });

      it("skips updating the current tab data if the updated tab is not active", async () => {
        tab.active = false;
        triggerTabOnUpdatedEvent(focusedWindowId, { status: "loading" }, tab);
        await flushPromises();

        expect(mainBackground.refreshMenu).not.toHaveBeenCalled();
        expect(overlayBackground.updateOverlayCiphers).not.toHaveBeenCalled();
      });

      it("skips updating the badge, context menu and notification bar if the `onUpdatedRan` property of the main background class is set to `true`", async () => {
        mainBackground.onUpdatedRan = true;
        triggerTabOnUpdatedEvent(focusedWindowId, { status: "loading" }, tab);
        await flushPromises();

        expect(mainBackground.refreshMenu).not.toHaveBeenCalled();
      });

      it("checks the notification queue", async () => {
        triggerTabOnUpdatedEvent(focusedWindowId, { status: "loading" }, tab);
        await flushPromises();

        expect(notificationBackground.checkNotificationQueue).toHaveBeenCalled();
      });

      it("updates the current tab data", async () => {
        triggerTabOnUpdatedEvent(focusedWindowId, { status: "loading" }, tab);
        await flushPromises();

        expect(mainBackground.refreshMenu).toHaveBeenCalled();
        expect(overlayBackground.updateOverlayCiphers).toHaveBeenCalled();
      });

      it("sends a `tabChanged` message to the messaging service", async () => {
        triggerTabOnUpdatedEvent(focusedWindowId, { status: "loading" }, tab);
        await flushPromises();

        expect(mainBackground.messagingService.send).toHaveBeenCalledWith("tabChanged");
      });
    });

    describe("handleTabOnRemoved", () => {
      it("removes the cached overlay page details", () => {
        triggerTabOnRemovedEvent(10, { windowId: 20, isWindowClosing: false });

        expect(overlayBackground.removePageDetails).toHaveBeenCalledWith(10);
      });
    });
  });
});
