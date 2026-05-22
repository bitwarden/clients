import { isIpcMessage } from "@bitwarden/common/platform/ipc/ipc-message";

type StoredHandlers = {
  windowMessageListener: (event: MessageEvent) => void;
  runtimeMessageListener: (message: unknown) => void;
};

const HANDLER_KEY = "__bitwardenIpcContentScriptHandlers__";

function hasBrowserRuntime(): boolean {
  return typeof browser !== "undefined" && typeof browser.runtime !== "undefined";
}

function isExtensionContextValid(): boolean {
  try {
    return !!chrome?.runtime?.id;
  } catch {
    return false;
  }
}

// Re-injection (e.g. after extension reload) re-runs this script in the same isolated-world
// window. Remove any handlers a previous run installed so listeners don't stack up.
const previous = (window as unknown as Record<string, StoredHandlers | undefined>)[HANDLER_KEY];
if (previous != null) {
  window.removeEventListener("message", previous.windowMessageListener);
  try {
    if (hasBrowserRuntime()) {
      browser.runtime.onMessage.removeListener(previous.runtimeMessageListener);
    } else {
      chrome.runtime.onMessage.removeListener(previous.runtimeMessageListener);
    }
  } catch {
    // The previous extension context is gone; nothing to remove.
  }
}

// Web -> Background
function sendExtensionMessage(message: unknown): boolean {
  if (!isExtensionContextValid()) {
    return false;
  }

  try {
    if (hasBrowserRuntime()) {
      void browser.runtime.sendMessage(message);
    } else {
      void chrome.runtime.sendMessage(message);
    }
    return true;
  } catch {
    return false;
  }
}

const windowMessageListener = (event: MessageEvent) => {
  if (event.origin !== window.origin) {
    return;
  }

  if (!isIpcMessage(event.data)) {
    return;
  }

  if (!sendExtensionMessage(event.data)) {
    // Stale instance from a previous extension context that hasn't been replaced yet
    // (e.g. on tabs where re-injection isn't possible). Detach so we stop trying.
    window.removeEventListener("message", windowMessageListener);
  }
};

window.addEventListener("message", windowMessageListener);

// Background -> Web
const runtimeMessageListener = (message: unknown) => {
  if (isIpcMessage(message)) {
    void window.postMessage(message);
  }
};

try {
  if (hasBrowserRuntime()) {
    browser.runtime.onMessage.addListener(runtimeMessageListener);
  } else {
    // eslint-disable-next-line no-restricted-syntax -- This doesn't run in the popup but in the content script
    chrome.runtime.onMessage.addListener(runtimeMessageListener);
  }
} catch {
  // Extension context not available; nothing to register.
}

(window as unknown as Record<string, StoredHandlers>)[HANDLER_KEY] = {
  windowMessageListener,
  runtimeMessageListener,
};
