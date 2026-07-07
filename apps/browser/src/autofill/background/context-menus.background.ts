/// <reference types="chrome"/>
import { BrowserApi } from "../../platform/browser/browser-api";
import { ContextMenuClickedHandler } from "../browser/context-menu-clicked-handler";

import { LockedVaultPendingNotificationsData } from "./abstractions/notification.background";
export default class ContextMenusBackground {
  private contextMenus: typeof chrome.contextMenus;

  constructor(private contextMenuClickedHandler: ContextMenuClickedHandler) {
    this.contextMenus = chrome.contextMenus;
  }

  init() {
    if (!this.contextMenus) {
      return;
    }

    this.contextMenus.onClicked.addListener((info, tab) => {
      if (tab) {
        return this.contextMenuClickedHandler.run(info, tab);
      }
    });

    BrowserApi.messageListener("contextmenus.background", this.handleContextMenusBackground);
  }

  private handleContextMenusBackground = (
    msg: { command: string; data?: LockedVaultPendingNotificationsData; tabId?: number },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ): true | void => {
    if (msg.command === "unlockCompleted" && msg.data?.target === "contextmenus.background") {
      const { contextMenuOnClickData: onClickData } = msg.data.commandToRetry.message;
      const { tab: senderTab } = msg.data.commandToRetry.sender;

      if (onClickData && senderTab) {
        void this.contextMenuClickedHandler.cipherAction(onClickData, senderTab).then(() => {
          if (sender.tab) {
            void BrowserApi.tabSendMessageData(sender.tab, "closeNotificationBar");
          }
        });
      }
      return;
    }

    if (msg.command === "getAutofillTriageResult") {
      const isOwnExtension = sender.id === chrome.runtime.id;
      const isExtensionPage = sender.tab === undefined;

      if (!isOwnExtension || !isExtensionPage || msg.tabId == null) {
        sendResponse(null);
        return true;
      }

      sendResponse(this.contextMenuClickedHandler.consumeTriageResult(msg.tabId) ?? null);
      return true;
    }

    return;
  };
}
