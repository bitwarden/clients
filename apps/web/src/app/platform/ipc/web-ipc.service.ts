import { inject } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcMessage, IpcService, isIpcMessage } from "@bitwarden/common/platform/ipc";
import {
  IncomingMessage,
  IpcClient,
  IpcCommunicationBackend,
  OutgoingMessage,
} from "@bitwarden/sdk-internal";

export class WebIpcService extends IpcService {
  private logService = inject(LogService);
  private communicationBackend: IpcCommunicationBackend;

  override async init() {
    try {
      // This function uses classes and functions defined in the SDK, so we need to wait for the SDK to load.
      await SdkLoadService.Ready;
      this.communicationBackend = new IpcCommunicationBackend({
        async send(message: OutgoingMessage): Promise<void> {
          if (message.destination === "BrowserBackground") {
            window.postMessage(
              {
                type: "bitwarden-ipc-message",
                message: { destination: message.destination, payload: message.payload },
              } satisfies IpcMessage,
              window.location.origin,
            );
            return;
          }

          throw new Error(`Destination not supported: ${message.destination}`);
        },
      });

      window.addEventListener("message", async (event: MessageEvent) => {
        const message = event.data;
        if (!isIpcMessage(message)) {
          return;
        }

        console.log("window.addEventListener(message", message);

        this.communicationBackend.deliver_message(
          new IncomingMessage(
            message.message.payload,
            message.message.destination,
            "BrowserBackground",
          ),
        );
      });

      this.client = new IpcClient(this.communicationBackend);

      await super.init();

      this.messages$.subscribe(console.log);
      void this.send(
        OutgoingMessage.new_json_payload({ message: "Hello from web" }, "BrowserBackground"),
      );
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }
}
