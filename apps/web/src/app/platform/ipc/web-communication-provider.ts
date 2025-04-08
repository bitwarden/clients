import { Injectable } from "@angular/core";

import { IpcMessage, isIpcMessage } from "@bitwarden/common/platform/ipc";
import { MessageQueue } from "@bitwarden/common/platform/ipc/message-queue";
import { CommunicationBackend, IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

@Injectable({ providedIn: "root" })
export class WebCommunicationProvider implements CommunicationBackend {
  private queue = new MessageQueue<IncomingMessage>();

  constructor() {
    window.addEventListener("message", async (event: MessageEvent) => {
      if (event.origin !== window.origin) {
        return;
      }

      const message = event.data;
      if (!isIpcMessage(message)) {
        return;
      }

      await this.queue.enqueue({ ...message.message, source: "BrowserBackground" });
    });
  }

  async send(message: OutgoingMessage): Promise<void> {
    if (message.destination === "BrowserBackground") {
      window.postMessage(
        { type: "bitwarden-ipc-message", message } satisfies IpcMessage,
        window.location.origin,
      );
      return;
    }

    throw new Error(`Destination not supported: ${message.destination}`);
  }

  receive(): Promise<IncomingMessage> {
    return this.queue.dequeue();
  }
}
