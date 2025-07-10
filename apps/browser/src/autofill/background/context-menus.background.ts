// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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

    this.contextMenus.onClicked.addListener((info, tab) =>
      this.contextMenuClickedHandler.run(info, tab),
    );

    BrowserApi.messageListener(
      "contextmenus.background",
      (
        msg: { command: string; data: LockedVaultPendingNotificationsData },
        sender: chrome.runtime.MessageSender,
      ) => {
        if (msg.command === "unlockCompleted" && msg.data.target === "contextmenus.background") {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.contextMenuClickedHandler
            .cipherAction(
              msg.data.commandToRetry.message.contextMenuOnClickData,
              msg.data.commandToRetry.sender.tab,
            )
            .then(() => {
              // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              BrowserApi.tabSendMessageData(sender.tab, "closeNotificationBar");
            });
        }
      },
    );
  }
}
