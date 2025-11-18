// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EVENTS } from "@bitwarden/common/autofill/constants";

import {
  NotificationBarIframeInitData,
  NotificationType,
  NotificationTypes,
} from "../../../notification/abstractions/notification-bar";
import { sendExtensionMessage, setElementStyles } from "../../../utils";
import {
  NotificationsExtensionMessage,
  OverlayNotificationsContentService as OverlayNotificationsContentServiceInterface,
  OverlayNotificationsExtensionMessageHandlers,
} from "../abstractions/overlay-notifications-content.service";

export class OverlayNotificationsContentService
  implements OverlayNotificationsContentServiceInterface
{
  private notificationBarRootElement: HTMLElement | null = null;
  private notificationBarElement: HTMLElement | null = null;
  private notificationBarIframeElement: HTMLIFrameElement | null = null;
  private notificationBarShadowRoot: ShadowRoot | null = null;
  private currentNotificationBarType: NotificationType | null = null;
  private notificationBarContainerStyles: Partial<CSSStyleDeclaration> = {
    height: "400px",
    width: "430px",
    maxWidth: "calc(100% - 20px)",
    minHeight: "initial",
    top: "10px",
    right: "0px",
    padding: "0",
    position: "fixed",
    zIndex: "2147483647",
    visibility: "visible",
    borderRadius: "4px",
    border: "none",
    backgroundColor: "transparent",
    overflow: "hidden",
    transition: "box-shadow 0.15s ease",
    transitionDelay: "0.15s",
  };

  private notificationBarIframeElementStyles: Partial<CSSStyleDeclaration> = {
    width: "100%",
    height: "100%",
    border: "0",
    display: "block",
    position: "relative",
    transition: "transform 0.15s ease-out, opacity 0.15s ease",
    borderRadius: "4px",
    colorScheme: "auto",
  };

  private readonly extensionMessageHandlers: OverlayNotificationsExtensionMessageHandlers = {
    openNotificationBar: ({ message }) => this.handleOpenNotificationBarMessage(message),
    closeNotificationBar: ({ message }) => this.handleCloseNotificationBarMessage(message),
    adjustNotificationBar: ({ message }) => this.handleAdjustNotificationBarHeightMessage(message),
    saveCipherAttemptCompleted: ({ message }) =>
      this.handleSaveCipherAttemptCompletedMessage(message),
  };

  constructor() {
    void sendExtensionMessage("checkNotificationQueue");
  }

  /**
   * Returns the message handlers for the content script.
   */
  get messageHandlers() {
    return this.extensionMessageHandlers;
  }

  /**
   * Opens the notification bar with the provided init data. Will trigger a closure
   * of the notification bar if the type of the notification bar changes.
   *
   * @param message - The message containing the initialization data for the notification bar.
   */
  private async handleOpenNotificationBarMessage(message: NotificationsExtensionMessage) {
    if (!message.data) {
      return;
    }
    const { type, typeData, params } = message.data;

    if (this.currentNotificationBarType && type !== this.currentNotificationBarType) {
      this.closeNotificationBar();
    }

    const initData = {
      type: type as NotificationType,
      isVaultLocked: typeData.isVaultLocked,
      theme: typeData.theme,
      removeIndividualVault: typeData.removeIndividualVault,
      importType: typeData.importType,
      launchTimestamp: typeData.launchTimestamp,
      params,
    };

    if (globalThis.document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.openNotificationBar(initData));
      return;
    }

    this.openNotificationBar(initData);
  }

  /**
   * Closes the notification bar. If the message contains a flag to fade out the notification,
   * the notification bar will fade out before being removed from the DOM.
   *
   * @param message - The message containing the data for closing the notification bar.
   */
  private handleCloseNotificationBarMessage(message: NotificationsExtensionMessage) {
    const closedByUser =
      typeof message.data?.closedByUser === "boolean" ? message.data.closedByUser : true;
    if (message.data?.fadeOutNotification) {
      setElementStyles(this.notificationBarIframeElement, { opacity: "0" }, true);
      globalThis.setTimeout(() => this.closeNotificationBar(closedByUser), 150);
      return;
    }

    this.closeNotificationBar(closedByUser);
  }

  /**
   * Adjusts the height of the notification bar.
   *
   * @param message - The message containing the height of the notification bar.
   */
  private handleAdjustNotificationBarHeightMessage(message: NotificationsExtensionMessage) {
    if (this.notificationBarElement && message.data?.height) {
      this.notificationBarElement.style.height = `${message.data.height}px`;
    }
  }

  /**
   * Handles the message for when a save cipher attempt has completed. This triggers an update
   * to the presentation of the notification bar, facilitating a visual indication of the save
   * attempt's success or failure.
   *
   * @param message
   * @private
   */
  private handleSaveCipherAttemptCompletedMessage(message: NotificationsExtensionMessage) {
    // destructure error out of data
    const { error, ...otherData } = message?.data || {};

    this.sendMessageToNotificationBarIframe({
      command: "saveCipherAttemptCompleted",
      data: Object.keys(otherData).length ? otherData : undefined,
      error,
    });
  }

  /**
   * Opens the notification bar with the given initialization data.
   *
   * @param initData
   * @private
   */
  private openNotificationBar(initData: NotificationBarIframeInitData) {
    if (!this.notificationBarRootElement && !this.notificationBarIframeElement) {
      this.createNotificationBarIframeElement(initData);
      this.createNotificationBarElement();

      this.setupInitNotificationBarMessageListener(initData);
      globalThis.document.body.appendChild(this.notificationBarRootElement);
    }
  }

  /**
   * Creates the iframe element for the notification bar.
   *
   * @param initData - The initialization data for the notification bar.
   */
  private createNotificationBarIframeElement(initData: NotificationBarIframeInitData) {
    const isNotificationFresh =
      initData.launchTimestamp && Date.now() - initData.launchTimestamp < 250;

    this.currentNotificationBarType = initData.type;
    this.notificationBarIframeElement = globalThis.document.createElement("iframe");
    this.notificationBarIframeElement.id = "bit-notification-bar-iframe";
    // this lint isn't valid in the context of an iframe
    // eslint-disable-next-line @bitwarden/platform/no-page-script-url-leakage
    this.notificationBarIframeElement.src = chrome.runtime.getURL("notification/bar.html");
    setElementStyles(
      this.notificationBarIframeElement,
      {
        ...this.notificationBarIframeElementStyles,
        transform: isNotificationFresh ? "translateX(100%)" : "translateX(0)",
        opacity: isNotificationFresh ? "1" : "0",
      },
      true,
    );
    this.notificationBarIframeElement.addEventListener(
      EVENTS.LOAD,
      this.handleNotificationBarIframeOnLoad,
    );
  }

  /**
   * Handles the load event for the notification bar iframe.
   * This will animate the notification bar into view.
   */
  private handleNotificationBarIframeOnLoad = () => {
    setElementStyles(
      this.notificationBarIframeElement,
      { transform: "translateX(0)", opacity: "1" },
      true,
    );

    this.notificationBarIframeElement?.removeEventListener(
      EVENTS.LOAD,
      this.handleNotificationBarIframeOnLoad,
    );
  };

  /**
   * Creates the container for the notification bar iframe with shadow DOM.
   */
  private createNotificationBarElement() {
    if (this.notificationBarIframeElement) {
      this.notificationBarRootElement = globalThis.document.createElement(
        "bit-notification-bar-root",
      );

      this.notificationBarShadowRoot = this.notificationBarRootElement.attachShadow({
        mode: "closed",
        delegatesFocus: true,
      });

      this.notificationBarElement = globalThis.document.createElement("div");
      this.notificationBarElement.id = "bit-notification-bar";

      setElementStyles(this.notificationBarElement, this.notificationBarContainerStyles, true);

      this.notificationBarShadowRoot.appendChild(this.notificationBarElement);
      this.notificationBarElement.appendChild(this.notificationBarIframeElement);
    }
  }

  /**
   * Sets up the message listener for the initialization of the notification bar.
   * This will send the initialization data to the notification bar iframe.
   *
   * @param initData - The initialization data for the notification bar.
   */
  private setupInitNotificationBarMessageListener(initData: NotificationBarIframeInitData) {
    const handleInitNotificationBarMessage = (event: MessageEvent) => {
      const { source, data } = event;
      if (
        source !== this.notificationBarIframeElement.contentWindow ||
        data?.command !== "initNotificationBar"
      ) {
        return;
      }

      this.sendMessageToNotificationBarIframe({ command: "initNotificationBar", initData });
      globalThis.removeEventListener("message", handleInitNotificationBarMessage);
    };

    if (this.notificationBarIframeElement) {
      globalThis.addEventListener("message", handleInitNotificationBarMessage);
    }
  }

  /**
   * Closes the notification bar. Will trigger a removal of the notification bar
   * from the background queue if the notification bar was closed by the user.
   *
   * @param closedByUserAction - Whether the notification bar was closed by the user.
   */
  private closeNotificationBar(closedByUserAction: boolean = false) {
    if (!this.notificationBarRootElement && !this.notificationBarIframeElement) {
      return;
    }

    this.notificationBarIframeElement.remove();
    this.notificationBarIframeElement = null;

    this.notificationBarElement.remove();
    this.notificationBarElement = null;
    this.notificationBarShadowRoot = null;
    this.notificationBarRootElement.remove();
    this.notificationBarRootElement = null;

    const removableNotificationTypes = new Set([
      NotificationTypes.Add,
      NotificationTypes.Change,
      NotificationTypes.AtRiskPassword,
    ] as NotificationType[]);

    if (closedByUserAction && removableNotificationTypes.has(this.currentNotificationBarType)) {
      void sendExtensionMessage("bgRemoveTabFromNotificationQueue");
    }

    this.currentNotificationBarType = null;
  }

  /**
   * Sends a message to the notification bar iframe.
   *
   * @param message - The message to send to the notification bar iframe.
   */
  private sendMessageToNotificationBarIframe(message: Record<string, any>) {
    if (this.notificationBarIframeElement) {
      this.notificationBarIframeElement.contentWindow.postMessage(message, "*");
    }
  }

  /**
   * Destroys the notification bar.
   */
  destroy() {
    this.closeNotificationBar(true);
  }
}
