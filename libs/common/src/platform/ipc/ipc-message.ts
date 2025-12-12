import type { OutgoingMessage } from "@bitwarden/sdk-internal";

export interface IpcMessage {
  type: "bitwarden-ipc-message";
  message: SerializedOutgoingMessage;
}

export interface SerializedOutgoingMessage
  extends Omit<OutgoingMessage, typeof Symbol.dispose | "free" | "payload"> {
  payload: number[];
}

export function isIpcMessage(message: any): message is IpcMessage {
  return message.type === "bitwarden-ipc-message";
}
