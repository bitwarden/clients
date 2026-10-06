import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcMessage, isIpcMessage } from "@bitwarden/common/platform/ipc";
import { IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../browser/browser-api";

import { DESTINATION_UNREACHABLE_ERROR } from "./errors";

/**
 * Transport for communicating with web vaults via content scripts for Manifest V3.
 *
 * Sends messages to tabs via {@link BrowserApi.tabSendMessage} and receives messages from tabs
 * through a {@link BrowserApi.messageListener}. Handles the `Web` destination.
 */
export class WebIpcTransport {
  constructor(
    private logService: LogService,
    private receive: (message: IncomingMessage) => void,
  ) {}

  init() {
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

      this.receive(
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
      // Tab may have been closed, or API not available.
      throw new Error(DESTINATION_UNREACHABLE_ERROR);
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
