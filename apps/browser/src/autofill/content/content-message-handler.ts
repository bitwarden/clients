import { setupExtensionDisconnectAction } from "../utils";

import {
  ContentMessageWindowData,
  ContentMessageWindowEventHandlers,
} from "./abstractions/content-message-handler";

/**
 * IMPORTANT: Safari seems to have a bug where it doesn't properly handle
 * window message events from content scripts when the listener for is
 * registered within a class. This is why these listeners are registered
 * at the top level of this file.
 */
window.addEventListener("message", handleWindowMessageEvent);
chrome.runtime.onMessage.addListener(handleExtensionMessage);
setupExtensionDisconnectAction(() => {
  window.removeEventListener("message", handleWindowMessageEvent);
  chrome.runtime.onMessage.removeListener(handleExtensionMessage);
});

/**
 * Handlers for window messages from the content script.
 */
const windowMessageHandlers: ContentMessageWindowEventHandlers = {
  checkIfReadyForAuthResult: () => handleCheckIfReadyForAuthResultMessage(),
  authResult: ({ data, referrer }: { data: any; referrer: string }) =>
    handleAuthResultMessage(data, referrer),
  webAuthnResult: ({ data, referrer }: { data: any; referrer: string }) =>
    handleWebAuthnResultMessage(data, referrer),
};

/**
 * Sends a message to the window verifying that the
 * content script is ready to receive an auth result.
 */
function handleCheckIfReadyForAuthResultMessage() {
  window.postMessage({ command: "readyToReceiveAuthResult" }, "*");
}

/**
 * Handles the auth result message from the window.
 *
 * @param data - Data from the window message
 * @param referrer - The referrer of the window
 */
async function handleAuthResultMessage(data: ContentMessageWindowData, referrer: string) {
  const { command, lastpass, code, state } = data;
  await chrome.runtime.sendMessage({ command, code, state, lastpass, referrer });
}

/**
 * Handles the webauthn result message from the window.
 *
 * @param data - Data from the window message
 * @param referrer - The referrer of the window
 */
async function handleWebAuthnResultMessage(data: ContentMessageWindowData, referrer: string) {
  const { command, remember } = data;
  await chrome.runtime.sendMessage({ command, data: data.data, remember, referrer });
}

/**
 * Handles the window message event.
 *
 * @param event - The window message event
 */
function handleWindowMessageEvent(event: MessageEvent) {
  const { source, data } = event;
  if (source !== window || !data?.command) {
    return;
  }

  const referrer = source.location.hostname;
  const handler = windowMessageHandlers[data.command];
  if (handler) {
    handler({ data, referrer });
  }
}

/**
 * Commands to forward from this script to the extension background.
 */
const forwardCommands = new Set([
  "bgUnlockPopoutOpened",
  "addToLockedVaultPendingNotifications",
  "unlockCompleted",
  "addedCipher",
]);

/**
 * Handles messages from the extension. Currently, this is
 * used to forward messages from the background context to
 * other scripts within the extension.
 *
 * @param message - The message from the extension
 */
async function handleExtensionMessage(message: any) {
  if (forwardCommands.has(message.command)) {
    await chrome.runtime.sendMessage(message);
  }
}
