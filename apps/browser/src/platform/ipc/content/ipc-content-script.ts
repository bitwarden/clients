// TODO: This content script should be dynamically reloaded when the extension is updated,
// to avoid "Extension context invalidated." errors.

import { isIpcMessage } from "@bitwarden/common/platform/ipc/ipc-message";

// Web -> Background
export function sendExtensionMessage(message: unknown) {
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

window.addEventListener("message", (event) => {
  if (event.origin !== window.origin) {
    return;
  }

  if (isIpcMessage(event.data)) {
    sendExtensionMessage(event.data);
  }
});

// Background -> Web
function setupMessageListener() {
  function listener(message: unknown) {
    if (isIpcMessage(message)) {
      void window.postMessage(message);
    }
  }

  if (
    typeof browser !== "undefined" &&
    typeof browser.runtime !== "undefined" &&
    typeof browser.runtime.onMessage !== "undefined"
  ) {
    browser.runtime.onMessage.addListener(listener);
    return;
  }

  // eslint-disable-next-line no-restricted-syntax -- This doesn't run in the popup but in the content script
  chrome.runtime.onMessage.addListener(listener);
}

setupMessageListener();
