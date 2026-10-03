/**
 * Name of the long-lived {@link chrome.runtime.Port} the web IPC content script opens to the
 * background. The content script (connect side) and {@link WebIpcTransport} (onConnect side) must
 * agree on this value; it also scopes the background's `onConnect` handler so only this port is
 * treated as IPC traffic.
 */
export const IPC_CONTENT_SCRIPT_PORT_NAME = "ipc-content-script-port";
