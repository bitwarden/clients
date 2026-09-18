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

/**
 * Rebuilds an {@link IpcMessage} from an untrusted object, copying only the fields the IPC
 * channel defines and discarding everything else.
 *
 * The content-script bridge relays page-originated messages to the background over
 * `chrome.runtime.sendMessage`, which delivers to every `onMessage` listener in the extension,
 * not just the IPC transport. Relaying the received object as-is would let a page smuggle
 * arbitrary extra properties (for example a `command`) onto that shared bus and reach the
 * legacy command handlers. Copying an explicit allowlist confines a page to the IPC transport,
 * which reads only `destination`, `payload`, and `topic`.
 */
export function reconstructIpcMessage(message: IpcMessage): IpcMessage {
  const { destination, payload, topic } = message.message ?? ({} as SerializedOutgoingMessage);
  return {
    type: "bitwarden-ipc-message",
    message: { destination, payload, topic },
  };
}

/**
 * The Bitwarden clients that reach the desktop app over native messaging and are not the browser
 * extension. The extension predates {@link IpcClientTypeMessage} and so never announces itself.
 */
export const IpcPeerClientType = Object.freeze({
  Cli: "cli",
} as const);
export type IpcPeerClientType = (typeof IpcPeerClientType)[keyof typeof IpcPeerClientType];

export function isIpcPeerClientType(value: unknown): value is IpcPeerClientType {
  return Object.values(IpcPeerClientType).includes(value as IpcPeerClientType);
}

/**
 * Announces which client is on the far end of a native-messaging connection.
 *
 * `desktop_proxy` is spawned the same way by every client, so the desktop app cannot tell a CLI
 * process from a browser background page from the socket alone, and addresses both as a browser
 * endpoint. A non-browser client sends this as its first frame to correct that.
 */
export interface IpcClientTypeMessage {
  type: "bitwarden-ipc-client-type";
  clientType: IpcPeerClientType;
}

export function isIpcClientTypeMessage(message: any): message is IpcClientTypeMessage {
  return (
    message != null &&
    message.type === "bitwarden-ipc-client-type" &&
    isIpcPeerClientType(message.clientType)
  );
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
