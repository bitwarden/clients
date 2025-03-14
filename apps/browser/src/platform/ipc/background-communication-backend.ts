import { IpcMessage, isIpcMessage } from "@bitwarden/common/platform/ipc";
import { MessageQueue } from "@bitwarden/common/platform/ipc/message-queue";
import { CommunicationBackend, IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../browser/browser-api";

export class BackgroundCommunicationBackend implements CommunicationBackend {
  private queue = new MessageQueue<IncomingMessage>();

  constructor() {
    BrowserApi.messageListener("platform.ipc", (message, sender) => {
      if (!isIpcMessage(message)) {
        return;
      }

      void this.queue.enqueue(
        new IncomingMessage(message.message.payload, message.message.destination, {
          Web: { id: sender.tab.id },
        }),
      );
    });
  }

  async send(message: OutgoingMessage): Promise<void> {
    if (typeof message.destination === "object") {
      await BrowserApi.tabSendMessage(
        { id: message.destination.Web.id } as chrome.tabs.Tab,
        { type: "bitwarden-ipc-message", message } satisfies IpcMessage,
        { frameId: 0 },
      );
      return;
    }

    throw new Error("Destination not supported.");
  }

  async receive(): Promise<IncomingMessage> {
    return this.queue.dequeue();
  }
}
