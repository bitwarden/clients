import type { OutgoingMessage } from "@bitwarden/sdk-internal";

export interface IpcMessage {
  type: "bitwarden-ipc-message";
  message: Omit<OutgoingMessage, "free">;
}

export function isIpcMessage(message: any): message is IpcMessage {
  return message.type === "bitwarden-ipc-message";
}
