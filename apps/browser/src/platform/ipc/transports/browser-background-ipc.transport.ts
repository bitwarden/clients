import { IpcMessage, isIpcMessage, reconstructIpcMessage } from "@bitwarden/common/platform/ipc";
import { IncomingMessage, OutgoingMessage, Source } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../browser/browser-api";

import {
  FOREGROUND_IPC_PORT_NAME,
  FOREGROUND_IPC_WAKE_PORT_NAME,
} from "./browser-foreground-ipc.transport";
import { DESTINATION_UNREACHABLE_ERROR } from "./errors";

const BACKGROUND_SOURCE = { BrowserBackground: { id: "Own" } } satisfies Source;

/**
 * Extension page side of the transport to the background. Holds a runtime port to the background
 * and handles the `BrowserBackground` destination. The port is opened by {@link init}, when the
 * background asks for it, or on the next send after a disconnect.
 */
export class BrowserBackgroundIpcTransport {
  private port?: chrome.runtime.Port;

  constructor(private receive: (message: IncomingMessage) => void) {}

  /**
   * Connects to the background so the page is addressable before it sends anything, and
   * reconnects when a restarted background asks open pages to connect.
   */
  init() {
    BrowserApi.addListener(chrome.runtime.onConnect, (port) => {
      // Other extension pages open unrelated ports that are also delivered here
      if (port.name !== FOREGROUND_IPC_WAKE_PORT_NAME) {
        return;
      }

      // The wake port is only a signal, closing it lets the background release it
      port.disconnect();
      this.connect();
    });

    this.connect();
  }

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

      // Suppress error message
      void chrome.runtime.lastError;
    });

    this.port = port;
    return port;
  }
}
