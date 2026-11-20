/// <reference types="chrome"/>
import { filter } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { isExternalMessage, MessageListener } from "@bitwarden/common/platform/messaging";

import { BrowserApi } from "../../platform/browser/browser-api";
import { ContextMenuClickedHandler } from "../browser/context-menu-clicked-handler";

import {
  LockedVaultPendingNotificationsData,
  RETRY_SENDER,
  RETRY_WHEN_UNLOCK_COMPLETED,
} from "./abstractions/notification.background";
export default class ContextMenusBackground {
  private contextMenus: typeof chrome.contextMenus;

  constructor(
    private contextMenuClickedHandler: ContextMenuClickedHandler,
    private messageListener: MessageListener,
    private logService: LogService,
  ) {
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

    this.messageListener
      .messages$(RETRY_WHEN_UNLOCK_COMPLETED)
      .pipe(filter((message) => !isExternalMessage(message)))
      .subscribe(({ data }) => {
        this.handleUnlockCompleted(data).catch((error) => this.logService.error(error));
      });

    BrowserApi.messageListener("contextmenus.background", this.handleContextMenusBackground);
  }

  /**
   * Retries the context menu click the user made while the vault was locked.
   *
   * @param data - The command the background retained when it opened the unlock popout
   * @see {@link RETRY_WHEN_UNLOCK_COMPLETED}
   */
  private async handleUnlockCompleted(data: LockedVaultPendingNotificationsData) {
    if (data?.target !== "contextmenus.background") {
      return;
    }

    const onClickData = data.commandToRetry?.message?.contextMenuOnClickData;
    const senderTab = data.commandToRetry?.[RETRY_SENDER]?.tab;

    if (!onClickData || !senderTab) {
      return;
    }

    await this.contextMenuClickedHandler.cipherAction(onClickData, senderTab);
    await BrowserApi.tabSendMessageData(senderTab, "closeNotificationBar");
  }

  private handleContextMenusBackground = (
    msg: { command: string; tabId?: number },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ): true | void => {
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
