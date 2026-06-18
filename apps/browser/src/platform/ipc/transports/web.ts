import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcMessage, isIpcMessage } from "@bitwarden/common/platform/ipc";
import { IpcCommunicationBackend, IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../browser/browser-api";

/**
 * Transport for communicating with web pages (content scripts) running in browser tabs.
 *
 * Sends extension -> tab messages via {@link BrowserApi.tabSendMessage} and receives tab ->
 * extension messages through a runtime message listener.
 */
export class WebIpcTransport {
  constructor(
    private getCommunicationBackend: () => IpcCommunicationBackend | undefined,
    private logService: LogService,
  ) {}

  /** Registers the runtime listener that pipes tab -> extension messages into the SDK. */
  registerListener(): void {
    BrowserApi.messageListener("platform.ipc", (message, sender) => {
      if (
        !isIpcMessage(message) ||
        typeof message.message.destination !== "object" ||
        !("BrowserBackground" in message.message.destination)
      ) {
        return;
      }

      if (sender.tab?.id === undefined || sender.tab.id === chrome.tabs.TAB_ID_NONE) {
        // Ignore messages from non-tab sources
        return;
      }

      if (sender.documentId === undefined) {
        this.logService.warning(
          "[IPC] Received message from tab without documentId (unsupported browser version)",
        );
        return;
      }

      this.getCommunicationBackend()?.receive(
        new IncomingMessage(
          new Uint8Array(message.message.payload),
          message.message.destination,
          {
            Web: {
              tab_id: sender.tab.id,
              document_id: sender.documentId,
              origin: sender.origin ?? "",
            },
          },
          message.message.topic,
        ),
      );
    });
  }

  /** Sends an extension -> tab message, dropping it if the target document has changed. */
  async send(message: OutgoingMessage): Promise<void> {
    if (typeof message.destination !== "object" || !("Web" in message.destination)) {
      throw new Error("Destination not supported.");
    }

    // Verify the document hasn't changed (e.g., user navigated away) before delivering.
    // If the browser doesn't support documentId on getFrame, skip the check and send anyway.
    try {
      const frame = await chrome.webNavigation.getFrame({
        tabId: message.destination.Web.tab_id,
        frameId: 0,
      });
      if (frame?.documentId != null && frame.documentId !== message.destination.Web.document_id) {
        this.logService.warning("[IPC] Dropping message to Web tab: document has changed");
        return;
      }
    } catch {
      // Tab may have been closed, or API not available. Drop the message.
      this.logService.warning("[IPC] Dropping message to Web tab: tab no longer accessible");
      return;
    }

    await BrowserApi.tabSendMessage(
      { id: message.destination.Web.tab_id } as chrome.tabs.Tab,
      {
        type: "bitwarden-ipc-message",
        message: {
          destination: message.destination,
          payload: [...message.payload],
          topic: message.topic,
        },
      } satisfies IpcMessage,
      { frameId: 0 },
    );
  }
}
