import MainBackground from "../../background/main.background";

import { OverlayBackground } from "./abstractions/overlay.background";
import NotificationBackground from "./notification.background";

export default class TabsBackground {
  constructor(
    private main: MainBackground,
    private notificationBackground: NotificationBackground,
    private overlayBackground: OverlayBackground,
  ) {}

  private focusedWindowId: number = -1;

  /**
   * Initializes the window and tab listeners.
   */
  async init() {
    if (!chrome.tabs || !chrome.windows) {
      return;
    }

    void this.updateCurrentTabData();
    void this.setupTabEventListeners();
  }

  /**
   * Sets up the tab and window event listeners.
   */
  private setupTabEventListeners() {
    chrome.windows.onFocusChanged.addListener(this.handleWindowOnFocusChanged);
    chrome.tabs.onActivated.addListener(this.handleTabOnActivated);
    chrome.tabs.onReplaced.addListener(this.handleTabOnReplaced);
    chrome.tabs.onUpdated.addListener(this.handleTabOnUpdated);
    chrome.tabs.onRemoved.addListener(this.handleTabOnRemoved);
  }

  /**
   * Handles the window onFocusChanged event.
   *
   * @param windowId - The ID of the window that was focused.
   */
  private handleWindowOnFocusChanged = async (windowId: number) => {
    if (windowId == null || windowId < 0) {
      return;
    }

    this.focusedWindowId = windowId;
    await this.updateCurrentTabData();
    this.main.messagingService.send("windowChanged");
  };

  /**
   * Handles the tab onActivated event.
   */
  private handleTabOnActivated = async () => {
    await this.updateCurrentTabData();
    this.main.messagingService.send("tabChanged");
  };

  /**
   * Handles the tab onReplaced event.
   */
  private handleTabOnReplaced = async () => {
    if (this.main.onReplacedRan) {
      return;
    }
    this.main.onReplacedRan = true;

    await this.notificationBackground.checkNotificationQueue();
    await this.updateCurrentTabData();
    this.main.messagingService.send("tabChanged");
  };

  /**
   * Handles the tab onUpdated event.
   *
   * @param tabId - The ID of the tab that was updated.
   * @param changeInfo - The change information.
   * @param tab - The updated tab.
   */
  private handleTabOnUpdated = async (
    tabId: number,
    changeInfo: chrome.tabs.OnUpdatedInfo,
    tab: chrome.tabs.Tab,
  ) => {
    if (this.focusedWindowId > 0 && tab.windowId !== this.focusedWindowId) {
      return;
    }

    if (!tab.active) {
      return;
    }

    await this.overlayBackground.updateOverlayCiphers(false);

    if (this.main.onUpdatedRan) {
      return;
    }
    this.main.onUpdatedRan = true;

    await this.notificationBackground.checkNotificationQueue(tab);
    await this.main.refreshMenu();
    this.main.messagingService.send("tabChanged");
  };

  /**
   * Handles the tab onRemoved event.
   *
   * @param tabId - The ID of the tab that was removed.
   */
  private handleTabOnRemoved = async (tabId: number) => {
    this.overlayBackground.removePageDetails(tabId);
  };

  /**
   * Updates the current tab data, refreshing the badge and context menu
   * for the current tab. Also updates the overlay ciphers.
   */
  private updateCurrentTabData = async () => {
    await Promise.all([
      this.main.refreshMenu(),
      this.overlayBackground.updateOverlayCiphers(false),
    ]);
  };
}
