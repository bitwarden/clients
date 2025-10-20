import type { Endpoint, OutgoingMessage } from "@bitwarden/sdk-internal";

export interface IpcMessage {
  type: "bitwarden-ipc-message";
  message: SerializedOutgoingMessage;
}

export interface ForwardedIpcMessage {
  type: "forwarded-bitwarden-ipc-message";
  message: SerializedOutgoingMessage;
  originalSource: Endpoint;
}

export interface SerializedOutgoingMessage extends Omit<OutgoingMessage, "free" | "payload"> {
  payload: number[];
}

export function isIpcMessage(message: any): message is IpcMessage {
  return message.type === "bitwarden-ipc-message";
}

export function isForwardedIpcMessage(message: any): message is ForwardedIpcMessage {
  return message.type === "forwarded-bitwarden-ipc-message";
}
