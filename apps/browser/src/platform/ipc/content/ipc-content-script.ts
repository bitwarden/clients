import { isIpcMessage, reconstructIpcMessage } from "@bitwarden/common/platform/ipc/ipc-message";

import { IPC_CONTENT_SCRIPT_PORT_NAME } from "../ipc-content-script-port-name";

// A single long-lived port carries IPC traffic between this page and the background in both
// directions. Using a dedicated port (instead of `chrome.runtime.sendMessage` /
// `chrome.runtime.onMessage`) keeps page-originated IPC traffic off the shared runtime message
// bus, so it can never reach the extension's legacy `command` handlers. The port's `onDisconnect`
// also doubles as the extension-teardown signal (see below).
let port: chrome.runtime.Port | undefined;

// Web -> Background
function handleWindowMessage(event: MessageEvent) {
  if (event.origin !== window.origin) {
    return;
  }

  if (isIpcMessage(event.data)) {
    // Relay a freshly built message rather than the page's object so a hostile page cannot smuggle
    // extra properties through. See reconstructIpcMessage.
    port?.postMessage(reconstructIpcMessage(event.data));
  }
}

// Background -> Web
function handlePortMessage(message: unknown) {
  if (isIpcMessage(message)) {
    void window.postMessage(message);
  }
}

function teardown() {
  window.removeEventListener("message", handleWindowMessage);
  if (port !== undefined) {
    port.onMessage.removeListener(handlePortMessage);
    port.disconnect();
    port = undefined;
  }
}

// The background service worker re-injects this script into already-open tabs whenever it
// (re)starts (see ipc-content-script-manager.service.ts). A plain service-worker restart does not
// invalidate the extension context, so a tab can still hold a live instance when the re-injection
// runs. All injections in a frame share one isolated world, so each instance exposes its teardown
// here and the next injection replaces (rather than stacks on top of) its predecessor.
// This keeps exactly one set of listeners and one port alive, avoiding the duplicate IPC message
// delivery that stacked listeners would cause.
const ipcWindow = window as Window & {
  __bitwardenIpcContentScript?: { teardown: () => void };
};

ipcWindow.__bitwardenIpcContentScript?.teardown();

port = chrome.runtime.connect({ name: IPC_CONTENT_SCRIPT_PORT_NAME });
port.onMessage.addListener(handlePortMessage);
// When the extension is reloaded (e.g. via `chrome.runtime.reload()` on process reload), the port
// disconnects while the runtime is still functional. Detach our listeners so a freshly re-injected
// content script registers its own without stacking on top of this instance.
port.onDisconnect.addListener(teardown);
window.addEventListener("message", handleWindowMessage);

ipcWindow.__bitwardenIpcContentScript = { teardown };
