import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcMessage, isIpcMessage, IpcService } from "@bitwarden/common/platform/ipc";
import {
  IpcClient,
  IpcCommunicationBackend,
  IncomingMessage,
  OutgoingMessage,
} from "@bitwarden/sdk-internal";

import { BrowserApi } from "../browser/browser-api";

export class IpcBackgroundService extends IpcService {
  private communicationBackend: IpcCommunicationBackend;

  constructor(private logService: LogService) {
    super();
  }

  override async init() {
    try {
      // This function uses classes and functions defined in the SDK, so we need to wait for the SDK to load.
      await SdkLoadService.Ready;
      this.communicationBackend = new IpcCommunicationBackend({
        async send(message: OutgoingMessage): Promise<void> {
          if (typeof message.destination === "object") {
            await BrowserApi.tabSendMessage(
              { id: message.destination.Web.id } as chrome.tabs.Tab,
              {
                type: "bitwarden-ipc-message",
                message: { destination: message.destination, payload: message.payload },
              } satisfies IpcMessage,
              { frameId: 0 },
            );
            return;
          }

          throw new Error("Destination not supported.");
        },
      });

      BrowserApi.messageListener("platform.ipc", (message, sender) => {
        if (!isIpcMessage(message)) {
          return;
        }

        this.communicationBackend.deliver_message(
          new IncomingMessage(message.message.payload, message.message.destination, {
            Web: { id: sender.tab.id },
          }),
        );
      });

      this.client = new IpcClient(this.communicationBackend);

      await super.init();

      this.messages$.subscribe((message) => {
        console.log("Received message", message);
        void this.send(
          OutgoingMessage.new_json_payload(
            { echo: { message: "Hello from background" } },
            message.source,
          ),
        );
      });
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }
}
