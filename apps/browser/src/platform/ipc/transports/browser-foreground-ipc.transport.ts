import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcMessage, isIpcMessage, reconstructIpcMessage } from "@bitwarden/common/platform/ipc";
import { IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../browser/browser-api";

import { DESTINATION_UNREACHABLE_ERROR } from "./errors";
import { IPC_FOREGROUND_PORT_NAME } from "./ipc-foreground-port-name";

/**
 * Background side of the transport between the background and extension pages (popup, popout,
 * sidebar). Each accepted runtime port is assigned a never-reused id and addressed as
 * `BrowserForeground { id }`. Handles the `BrowserForeground` destination.
 */
export class BrowserForegroundIpcTransport {
  private ports = new Map<number, chrome.runtime.Port>();
  private nextId = 1;

  constructor(
    private logService: LogService,
    private receive: (message: IncomingMessage) => void,
  ) {}

  init() {
    BrowserApi.addListener(chrome.runtime.onConnect, (port) => {
      if (port.name !== IPC_FOREGROUND_PORT_NAME) {
        return;
      }
      if (!BrowserApi.senderIsInternal(port.sender, this.logService)) {
        return;
      }

      const id = this.nextId++;
      const source = { BrowserForeground: { id } };
      this.ports.set(id, port);

      const onMessage = (message: unknown) => {
        if (
          !isIpcMessage(message) ||
          typeof message.message?.destination !== "object" ||
          !("BrowserBackground" in message.message.destination)
        ) {
          return;
        }
        const { destination, payload, topic } = reconstructIpcMessage(message).message;
        this.receive(new IncomingMessage(new Uint8Array(payload), destination, source, topic));
      };

      port.onMessage.addListener(onMessage);
      port.onDisconnect.addListener(() => {
        port.onMessage.removeListener(onMessage);
        this.ports.delete(id);

        // Suppress error message
        void chrome.runtime.lastError;
      });
    });
  }

  async send(message: OutgoingMessage): Promise<void> {
    if (typeof message.destination !== "object" || !("BrowserForeground" in message.destination)) {
      throw new Error("Destination not supported.");
    }

    const port = this.ports.get(message.destination.BrowserForeground.id);
    if (port == null) {
      throw new Error(DESTINATION_UNREACHABLE_ERROR);
    }

    try {
      port.postMessage({
        type: "bitwarden-ipc-message",
        message: {
          destination: message.destination,
          payload: [...message.payload],
          topic: message.topic,
        },
      } satisfies IpcMessage);
    } catch {
      throw new Error(DESTINATION_UNREACHABLE_ERROR);
    }
  }
}
