import { isIpcMessage } from "@bitwarden/common/platform/ipc/ipc-message";

const IPC_CONTENT_SCRIPT_PORT_NAME = "ipc-content-script-port";

// Web -> Background
function sendExtensionMessage(message: unknown) {
  if (
    typeof browser !== "undefined" &&
    typeof browser.runtime !== "undefined" &&
    typeof browser.runtime.sendMessage !== "undefined"
  ) {
    void browser.runtime.sendMessage(message);
    return;
  }

  void chrome.runtime.sendMessage(message);
}

function handleWindowMessage(event: MessageEvent) {
  if (event.origin !== window.origin) {
    return;
  }

  if (isIpcMessage(event.data)) {
    sendExtensionMessage(event.data);
  }
}

// Background -> Web
function handleRuntimeMessage(message: unknown) {
  if (isIpcMessage(message)) {
    void window.postMessage(message);
  }
}

function addRuntimeMessageListener() {
  if (
    typeof browser !== "undefined" &&
    typeof browser.runtime !== "undefined" &&
    typeof browser.runtime.onMessage !== "undefined"
  ) {
    browser.runtime.onMessage.addListener(handleRuntimeMessage);
    return;
  }

  // eslint-disable-next-line no-restricted-syntax -- This doesn't run in the popup but in the content script
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
}

function removeRuntimeMessageListener() {
  if (
    typeof browser !== "undefined" &&
    typeof browser.runtime !== "undefined" &&
    typeof browser.runtime.onMessage !== "undefined"
  ) {
    browser.runtime.onMessage.removeListener(handleRuntimeMessage);
    return;
  }

  chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
}

/**
 * Opens a long-lived port whose only purpose is to surface extension-context
 * teardown via `onDisconnect`. When the extension is reloaded (e.g. via
 * `chrome.runtime.reload()` on process reload), this fires while the runtime
 * is still functional, letting us detach our listeners before a freshly
 * re-injected content script registers its own.
 */
function setupExtensionDisconnectAction(callback: (port: chrome.runtime.Port) => void) {
  const port = chrome.runtime.connect({ name: IPC_CONTENT_SCRIPT_PORT_NAME });
  const onDisconnect = (disconnectedPort: chrome.runtime.Port) => {
    callback(disconnectedPort);
    port.onDisconnect.removeListener(onDisconnect);
  };
  port.onDisconnect.addListener(onDisconnect);
}

window.addEventListener("message", handleWindowMessage);
addRuntimeMessageListener();
setupExtensionDisconnectAction(() => {
  window.removeEventListener("message", handleWindowMessage);
  removeRuntimeMessageListener();
});
