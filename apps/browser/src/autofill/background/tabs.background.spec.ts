import { mock } from "jest-mock-extended";
import { BehaviorSubject, map, Subject } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";

import MainBackground from "../../background/main.background";
import { FillCipherPolicy } from "../services/abstractions/fill-cipher-policy";
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
  const userId = "user-1" as UserId;
  const otherUserId = "user-2" as UserId;

  let tabsBackground: TabsBackground;
  let activeAccount$: BehaviorSubject<Account | null>;
  let authStatuses$: BehaviorSubject<Record<UserId, AuthenticationStatus>>;
  let changed: Record<UserId, Subject<void>>;
  const fillCipherPolicy = mock<FillCipherPolicy>();
  const mainBackground = mock<MainBackground>({
    messagingService: {
      send: jest.fn(),
    },
  });
  const notificationBackground = mock<NotificationBackground>();
  const overlayBackground = mock<OverlayBackground>();

  beforeEach(() => {
    activeAccount$ = new BehaviorSubject<Account | null>({ id: userId } as Account);
    authStatuses$ = new BehaviorSubject<Record<UserId, AuthenticationStatus>>({
      [userId]: AuthenticationStatus.Unlocked,
      [otherUserId]: AuthenticationStatus.Unlocked,
    });
    changed = { [userId]: new Subject<void>(), [otherUserId]: new Subject<void>() };
    fillCipherPolicy.changed$.mockImplementation((id) => changed[id]);
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = activeAccount$;
    mainBackground.accountService = accountService;
    const authService = mock<AuthService>();
    authService.authStatusFor$.mockImplementation((id) =>
      authStatuses$.pipe(map((statuses) => statuses[id])),
    );
    mainBackground.authService = authService;
    mainBackground.fillCipherPolicy = fillCipherPolicy;
    mainBackground.logService = mock<MainBackground["logService"]>();
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

      void tabsBackground.init();

      expect(chrome.windows.onFocusChanged.addListener).toHaveBeenCalledWith(
        handleWindowOnFocusChangedSpy,
      );
    });
  });

  describe("fill cipher changes", () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      void tabsBackground.init();
      await jest.advanceTimersByTimeAsync(0);
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const settle = () => jest.advanceTimersByTimeAsync(0);

    it("refreshes the context menu and all inline menu ciphers on the first emission", async () => {
      changed[userId].next();
      await settle();

      expect(mainBackground.refreshMenu).toHaveBeenCalledTimes(1);
      expect(overlayBackground.updateOverlayCiphers).toHaveBeenCalledTimes(1);
      expect(overlayBackground.updateOverlayCiphers).toHaveBeenCalledWith();
    });

    it("refreshes once for the emissions of one tick", async () => {
      changed[userId].next();
      changed[userId].next();
      await settle();

      expect(mainBackground.refreshMenu).toHaveBeenCalledTimes(1);
      expect(overlayBackground.updateOverlayCiphers).toHaveBeenCalledTimes(1);
    });

    it("refreshes again for a later change", async () => {
      changed[userId].next();
      await settle();
      changed[userId].next();
      await settle();

      expect(mainBackground.refreshMenu).toHaveBeenCalledTimes(2);
      expect(overlayBackground.updateOverlayCiphers).toHaveBeenCalledTimes(2);
    });

    it("follows the active account", async () => {
      activeAccount$.next({ id: otherUserId } as Account);

      changed[userId].next();
      await settle();
      expect(mainBackground.refreshMenu).not.toHaveBeenCalled();

      changed[otherUserId].next();
      await settle();
      expect(mainBackground.refreshMenu).toHaveBeenCalledTimes(1);
    });

    it("drops a change pending when the user locks", async () => {
      changed[userId].next();
      authStatuses$.next({ [userId]: AuthenticationStatus.Locked });
      await settle();

      expect(mainBackground.refreshMenu).not.toHaveBeenCalled();
      expect(overlayBackground.updateOverlayCiphers).not.toHaveBeenCalled();
    });

    it("keeps refreshing after a refresh fails", async () => {
      mainBackground.refreshMenu.mockRejectedValueOnce(new Error("failed"));

      changed[userId].next();
      await settle();
      changed[userId].next();
      await settle();

      expect(mainBackground.logService.error).toHaveBeenCalledTimes(1);
      expect(mainBackground.refreshMenu).toHaveBeenCalledTimes(2);
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
