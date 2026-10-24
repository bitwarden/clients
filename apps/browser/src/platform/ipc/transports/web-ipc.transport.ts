import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcMessage, isIpcMessage } from "@bitwarden/common/platform/ipc";
import { IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../browser/browser-api";
import { IPC_CONTENT_SCRIPT_PORT_NAME } from "../ipc-content-script-port-name";

import { DESTINATION_UNREACHABLE_ERROR } from "./errors";

interface RegisteredPort {
  port: chrome.runtime.Port;
  tabId: number;
}

/**
 * Transport for communicating with web vaults via content scripts for Manifest V3.
 *
 * Communicates over a dedicated {@link chrome.runtime.Port} per content-script document rather than
 * `chrome.runtime.sendMessage`. Port traffic is delivered only to this transport's `onConnect`
 * handler, never to the shared `chrome.runtime.onMessage` bus, so a page cannot use the IPC channel
 * to reach the extension's legacy `command` handlers. Handles the `Web` destination.
 *
 * The message source is always taken from the browser-provided {@link chrome.runtime.Port.sender},
 * never from the message body, so a page cannot forge its own tab, document, or origin.
 */
export class WebIpcTransport {
  /**
   * Live content-script ports keyed by their document. `documentId` is unique per loaded document,
   * so a navigation registers a new entry rather than colliding with the previous document's port.
   */
  private readonly ports = new Map<string, RegisteredPort>();

  constructor(
    private logService: LogService,
    private receive: (message: IncomingMessage) => void,
  ) {}

  init() {
    BrowserApi.addListener(chrome.runtime.onConnect, (port) => this.handleConnect(port));
  }

  private handleConnect(port: chrome.runtime.Port) {
    if (port.name !== IPC_CONTENT_SCRIPT_PORT_NAME) {
      return;
    }

    const sender = port.sender;
    const tabId = sender?.tab?.id;
    if (tabId === undefined || tabId === chrome.tabs.TAB_ID_NONE) {
      // Ignore connections from non-tab sources.
      return;
    }

    const documentId = sender?.documentId;
    if (documentId === undefined) {
      this.logService.warning(
        "[IPC] Received connection from tab without documentId (unsupported browser version)",
      );
      return;
    }

    this.ports.set(documentId, { port, tabId });

    port.onMessage.addListener((message) => this.handleMessage(message, tabId, documentId, sender));
    port.onDisconnect.addListener(() => {
      // Only drop the entry if this exact port still owns it; a fast navigate-and-reconnect may
      // already have replaced it with the new document's port.
      if (this.ports.get(documentId)?.port === port) {
        this.ports.delete(documentId);
      }
    });
  }

  private handleMessage(
    message: unknown,
    tabId: number,
    documentId: string,
    sender: chrome.runtime.MessageSender,
  ) {
    if (
      !isIpcMessage(message) ||
      typeof message.message.destination !== "object" ||
      !("BrowserBackground" in message.message.destination)
    ) {
      return;
    }

    this.receive(
      new IncomingMessage(
        new Uint8Array(message.message.payload),
        message.message.destination,
        {
          Web: {
            tab_id: tabId,
            document_id: documentId,
            origin: sender.origin ?? "",
          },
        },
        message.message.topic,
      ),
    );
  }

  async send(message: OutgoingMessage): Promise<void> {
    if (typeof message.destination !== "object" || !("Web" in message.destination)) {
      throw new Error("Destination not supported.");
    }

    const { tab_id: tabId, document_id: documentId } = message.destination.Web;
    const registered = this.ports.get(documentId);

    // A missing or mismatched port means the target document is no longer live (the user navigated
    // away or the tab closed). The port's own lifecycle replaces the previous webNavigation
    // document check.
    if (registered === undefined || registered.tabId !== tabId) {
      this.logService.warning(
        "[IPC] Dropping message to Web tab: no live content-script port for the destination document",
      );
      throw new Error(DESTINATION_UNREACHABLE_ERROR);
    }

    registered.port.postMessage({
      type: "bitwarden-ipc-message",
      message: {
        destination: message.destination,
        payload: [...message.payload],
        topic: message.topic,
      },
    } satisfies IpcMessage);
  }
}
