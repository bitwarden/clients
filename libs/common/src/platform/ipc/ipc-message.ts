import type { OutgoingMessage, Source } from "@bitwarden/sdk-internal";

export interface IpcMessage {
  type: "bitwarden-ipc-message";
  message: SerializedOutgoingMessage;
}

export interface ForwardedIpcMessage {
  type: "forwarded-bitwarden-ipc-message";
  message: SerializedOutgoingMessage;
  originalSource: Source;
}

export interface SerializedOutgoingMessage extends Omit<
  OutgoingMessage,
  typeof Symbol.dispose | "free" | "payload"
> {
  payload: number[];
}

export function isIpcMessage(message: any): message is IpcMessage {
  return message != null && message.type === "bitwarden-ipc-message";
}

export function isForwardedIpcMessage(message: any): message is ForwardedIpcMessage {
  return message != null && message.type === "forwarded-bitwarden-ipc-message";
}

/**
 * Detects the `{ command: "connected" }` message emitted by the `desktop_proxy` native-messaging
 * binary after connecting to the desktop app.
 */
export function isProxyConnectedMessage(message: any): boolean {
  return message != null && message.command === "connected";
}
