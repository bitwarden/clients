import { ExtensionPageUrls } from "@bitwarden/common/vault/enums";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";

import {
  ContentMessageWindowData,
  ContentMessageWindowEventHandlers,
} from "./abstractions/content-message-handler";

/**
 * Handlers for window messages from the content script.
 * NOTE: These handlers should be above the event listener to ensure they are defined before being used.
 */
const windowMessageHandlers: ContentMessageWindowEventHandlers = {
  authResult: ({ data, referrer }: { data: any; referrer: string }) =>
    handleAuthResultMessage(data, referrer),
  webAuthnResult: ({ data, referrer }: { data: any; referrer: string }) =>
    handleWebAuthnResultMessage(data, referrer),
  [VaultMessages.checkBwInstalled]: () => handleExtensionInstallCheck(),
  duoResult: ({ data, referrer }: { data: any; referrer: string }) =>
    handleDuoResultMessage(data, referrer),
  [VaultMessages.OpenAtRiskPasswords]: () => handleOpenAtRiskPasswordsMessage(),
  [VaultMessages.OpenBrowserExtensionToUrl]: ({ data, referrer }) =>
    handleOpenBrowserExtensionToUrlMessage({ url: data.url, referrer }),
};

/**
 * IMPORTANT: Safari seems to have a bug where it doesn't properly handle
 * window message events from content scripts when the listener these events
 * is registered within a class. This is why these listeners are registered
 * at the top level of this file.
 */
window.addEventListener("message", handleWindowMessageEvent, false);
chrome.runtime.onMessage.addListener(handleExtensionMessage);
setupExtensionDisconnectAction(() => {
  window.removeEventListener("message", handleWindowMessageEvent);
  chrome.runtime.onMessage.removeListener(handleExtensionMessage);
});

/**
 * Handles the post to the web vault showing the extension has been installed
 */
function handleExtensionInstallCheck() {
  window.postMessage({ command: VaultMessages.HasBwInstalled });
}

/**
 * Handles the auth result message from the window.
 *
 * @param data - Data from the window message
 * @param referrer - The referrer of the window
 */
function handleAuthResultMessage(data: ContentMessageWindowData, referrer: string) {
  const { command, lastpass, code, state } = data;
  sendExtensionRuntimeMessage({ command, code, state, lastpass, referrer });
}

/**
 * Handles the Duo 2FA result message from the window.
 *
 * @param data - Data from the window message
 * @param referrer - The referrer of the window
 */
async function handleDuoResultMessage(data: ContentMessageWindowData, referrer: string) {
  const { command, code, state } = data;
  sendExtensionRuntimeMessage({ command, code, state, referrer });
}

/**
 * Handles the webauthn result message from the window.
 *
 * @param data - Data from the window message
 * @param referrer - The referrer of the window
 */
function handleWebAuthnResultMessage(data: ContentMessageWindowData, referrer: string) {
  const { command, remember } = data;
  sendExtensionRuntimeMessage({ command, data: data.data, remember, referrer });
}

/** @deprecated use {@link handleOpenBrowserExtensionToUrlMessage} */
function handleOpenAtRiskPasswordsMessage() {
  sendExtensionRuntimeMessage({ command: VaultMessages.OpenAtRiskPasswords });
}

function handleOpenBrowserExtensionToUrlMessage({
  url,
  referrer,
}: {
  url?: ExtensionPageUrls;
  referrer?: string;
}) {
  sendExtensionRuntimeMessage({
    command: VaultMessages.OpenBrowserExtensionToUrl,
    url,
    referrer,
  });
}

/**
 * Handles the window message event.
 *
 * @param event - The window message event
 */
function handleWindowMessageEvent(event: MessageEvent) {
  const { source, data, origin } = event;
  if (source !== window || !data?.command) {
    return;
  }

  // use event.origin instead of source.location
  // extract hostname from origin for referrer validation in background script
  let referrer: string;
  try {
    const originUrl = new URL(origin);
    referrer = originUrl.hostname;
  } catch {
    // fallback to window.location.hostname if origin parsing fails
    referrer = window.location.hostname;
  }

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
function handleExtensionMessage(message: any) {
  if (forwardCommands.has(message.command)) {
    sendExtensionRuntimeMessage(message);
  }
}

/**
 * Sends a message to the extension runtime, and ignores
 * any potential promises that should be handled using
 * the `void` operator.
 *
 * @param message - The message to send to the extension runtime
 */
function sendExtensionRuntimeMessage(message: any) {
  void chrome.runtime.sendMessage(message);
}

/**
 * Duplicate implementation of the same named method within `apps/browser/src/autofill/utils/index.ts`.
 * This is done due to some strange observed compilation behavior present when importing the method from
 * the utils file.
 *
 * TODO: Investigate why webpack tree shaking is not removing other methods when importing from the utils file.
 * Possible cause can be seen below:
 * @see https://stackoverflow.com/questions/71679366/webpack5-does-not-seem-to-tree-shake-unused-exports
 *
 * @param callback - Callback function to run when the extension disconnects
 */
function setupExtensionDisconnectAction(callback: (port: chrome.runtime.Port) => void) {
  const port = chrome.runtime.connect({ name: "autofill-injected-script-port" });
  const onDisconnectCallback = (disconnectedPort: chrome.runtime.Port) => {
    callback(disconnectedPort);
    port.onDisconnect.removeListener(onDisconnectCallback);
  };
  port.onDisconnect.addListener(onDisconnectCallback);
}
