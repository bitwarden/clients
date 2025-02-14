import { IpcMessage, isIpcMessage } from "@bitwarden/common/platform/ipc";
import { MessageQueue } from "@bitwarden/common/platform/ipc/message-queue";
import { CommunicationProvider, Message } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../browser/browser-api";

export class BackgroundCommunicationProvider implements CommunicationProvider {
  private queue = new MessageQueue<Message>();

  constructor() {
    BrowserApi.messageListener("platform.ipc", (message, sender) => {
      if (!isIpcMessage(message)) {
        return;
      }

      void this.queue.enqueue({ ...message.message, source: { Web: sender.tab.id } });
    });
  }

  async send(message: Message): Promise<void> {
    if (typeof message.destination === "object") {
      await BrowserApi.tabSendMessage(
        { id: message.destination.Web } as chrome.tabs.Tab,
        { type: "bitwarden-ipc-message", message } satisfies IpcMessage,
        { frameId: 0 },
      );
      return;
    }

    throw new Error("Destination not supported.");
  }

  async receive(): Promise<Message> {
    return this.queue.dequeue();
  }
}
