import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  IpcMessage,
  isIpcMessage,
  reconstructIpcMessage,
  SerializedOutgoingMessage,
} from "@bitwarden/common/platform/ipc";
import { IncomingMessage, OutgoingMessage, Source } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../browser/browser-api";

import { DESTINATION_UNREACHABLE_ERROR } from "./errors";
import { IPC_FOREGROUND_PORT_NAME } from "./ipc-foreground-port-name";

// Matches the SDK's incoming channel capacity, so draining the held messages cannot overflow it.
const MAX_PENDING_MESSAGES = 20;

type ReceivedMessage = { message: SerializedOutgoingMessage; source: Source };

/**
 * Background side of the transport between the background and extension pages (popup, popout,
 * sidebar). Each accepted runtime port is assigned a never-reused id and addressed as
 * `BrowserForeground { id }`. Handles the `BrowserForeground` destination.
 */
export class BrowserForegroundIpcTransport {
  private ports = new Map<number, chrome.runtime.Port>();
  private nextId = 1;
  private started = false;
  private pending: ReceivedMessage[] = [];

  constructor(
    private logService: LogService,
    private receive: (message: IncomingMessage) => void,
  ) {}

  /**
   * Starts accepting ports. Must run synchronously during service worker startup so a port that
   * wakes the worker is not missed. Up to {@link MAX_PENDING_MESSAGES} messages are held until
   * {@link start} is called, dropping the oldest.
   */
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
        this.deliver({ message: reconstructIpcMessage(message).message, source });
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

  /**
   * Delivers held and future messages to the IPC client. Requires the SDK to be loaded.
   */
  start() {
    this.started = true;
    const pending = this.pending;
    this.pending = [];
    pending.forEach((message) => this.deliver(message));
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

  private deliver({ message, source }: ReceivedMessage) {
    if (!this.started) {
      if (this.pending.length >= MAX_PENDING_MESSAGES) {
        this.pending.shift();
      }
      this.pending.push({ message, source });
      return;
    }
    this.receive(
      new IncomingMessage(
        new Uint8Array(message.payload),
        message.destination,
        source,
        message.topic,
      ),
    );
  }
}
