// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";

import { BrowserApi } from "../browser/browser-api";
import BrowserClipboardService from "../services/browser-clipboard.service";

import {
  OffscreenDocumentExtensionMessage,
  OffscreenDocumentExtensionMessageHandlers,
  OffscreenDocument as OffscreenDocumentInterface,
} from "./abstractions/offscreen-document";

class OffscreenDocument implements OffscreenDocumentInterface {
  private consoleLogService: ConsoleLogService = new ConsoleLogService(false);
  private readonly extensionMessageHandlers: OffscreenDocumentExtensionMessageHandlers = {
    offscreenCopyToClipboard: ({ message }) => this.handleOffscreenCopyToClipboard(message),
    offscreenReadFromClipboard: () => this.handleOffscreenReadFromClipboard(),
    localStorageGet: ({ message }) => this.handleLocalStorageGet(message.key),
    localStorageSave: ({ message }) => this.handleLocalStorageSave(message.key, message.value),
    localStorageRemove: ({ message }) => this.handleLocalStorageRemove(message.key),
  };

  /**
   * Initializes the offscreen document extension.
   */
  init() {
    this.setupExtensionMessageListener();
  }

  /**
   * Copies the given text to the user's clipboard.
   *
   * @param message - The extension message containing the text to copy
   */
  private async handleOffscreenCopyToClipboard(message: OffscreenDocumentExtensionMessage) {
    await BrowserClipboardService.copy(self, message.text);
  }

  /**
   * Reads the user's clipboard and returns the text.
   */
  private async handleOffscreenReadFromClipboard() {
    return await BrowserClipboardService.read(self);
  }

  private handleLocalStorageGet(key: string) {
    return self.localStorage.getItem(key);
  }

  private handleLocalStorageSave(key: string, value: string) {
    self.localStorage.setItem(key, value);
  }

  private handleLocalStorageRemove(key: string) {
    self.localStorage.removeItem(key);
  }

  /**
   * Sets up the listener for extension messages.
   */
  private setupExtensionMessageListener() {
    BrowserApi.messageListener("offscreen-document", this.handleExtensionMessage);
  }

  /**
   * Handles extension messages sent to the extension background.
   *
   * @param message - The message received from the extension
   * @param sender - The sender of the message
   * @param sendResponse - The response to send back to the sender
   */
  private handleExtensionMessage = (
    message: OffscreenDocumentExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ) => {
    const handler: CallableFunction | undefined = this.extensionMessageHandlers[message?.command];
    if (!handler) {
      return;
    }

    const messageResponse = handler({ message, sender });
    if (!messageResponse) {
      return;
    }

    Promise.resolve(messageResponse)
      .then((response) => sendResponse(response))
      .catch((error) =>
        this.consoleLogService.error("Error resolving extension message response", error),
      );
    return true;
  };
}

(() => {
  const offscreenDocument = new OffscreenDocument();
  offscreenDocument.init();
})();
