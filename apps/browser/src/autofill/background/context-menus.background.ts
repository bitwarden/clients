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

    BrowserApi.messageListener(
      "contextmenus.background",
      (
        msg: { command: string; data: LockedVaultPendingNotificationsData },
        sender: chrome.runtime.MessageSender,
      ) => {
        if (msg.command === "unlockCompleted" && msg.data.target === "contextmenus.background") {
          const onClickData = msg.data.commandToRetry.message.contextMenuOnClickData;
          const senderTab = msg.data.commandToRetry.sender.tab;

          if (onClickData && senderTab) {
            void this.contextMenuClickedHandler.cipherAction(onClickData, senderTab).then(() => {
              if (sender.tab) {
                void BrowserApi.tabSendMessageData(sender.tab, "closeNotificationBar");
              }
            });
          }
        }
      },
    );
  }
}
