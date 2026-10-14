import { IpcMessage, isIpcMessage, reconstructIpcMessage } from "@bitwarden/common/platform/ipc";
import { Endpoint, IncomingMessage, OutgoingMessage, Source } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../browser/browser-api";

import { FOREGROUND_IPC_PORT_NAME } from "./browser-foreground-ipc.transport";
import { DESTINATION_UNREACHABLE_ERROR } from "./errors";

const BACKGROUND_SOURCE = { BrowserBackground: { id: "Own" } } satisfies Source;

/**
 * Extension page side of the transport to the background. Connects a runtime port on first send
 * and handles the `BrowserBackground` destination.
 */
export class BrowserBackgroundIpcTransport {
  private port?: chrome.runtime.Port;

  constructor(
    private receive: (message: IncomingMessage) => void,
    private onDisconnect?: (endpoint: Endpoint) => void,
  ) {}

  async send(message: OutgoingMessage): Promise<void> {
    if (typeof message.destination !== "object" || !("BrowserBackground" in message.destination)) {
      throw new Error("Destination not supported.");
    }

    try {
      this.connect().postMessage({
        type: "bitwarden-ipc-message",
        message: {
          destination: message.destination,
          payload: [...message.payload],
          topic: message.topic,
        },
      } satisfies IpcMessage);
    } catch {
      this.port = undefined;
      throw new Error(DESTINATION_UNREACHABLE_ERROR);
    }
  }

  private connect(): chrome.runtime.Port {
    if (this.port != null) {
      return this.port;
    }

    const port = chrome.runtime.connect({ name: FOREGROUND_IPC_PORT_NAME });

    BrowserApi.addListener(port.onMessage, (message: unknown) => {
      if (
        !isIpcMessage(message) ||
        typeof message.message?.destination !== "object" ||
        !("BrowserForeground" in message.message.destination)
      ) {
        return;
      }
      const { destination, payload, topic } = reconstructIpcMessage(message).message;
      this.receive(
        new IncomingMessage(new Uint8Array(payload), destination, BACKGROUND_SOURCE, topic),
      );
    });

    BrowserApi.addListener(port.onDisconnect, () => {
      if (this.port === port) {
        this.port = undefined;
      }
      this.onDisconnect?.(BACKGROUND_SOURCE);

      // Suppress error message
      void chrome.runtime.lastError;
    });

    this.port = port;
    return port;
  }
}
