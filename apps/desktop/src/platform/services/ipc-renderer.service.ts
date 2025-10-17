import { inject } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import {
  ForwardedIpcMessage,
  IpcMessage,
  IpcService,
  isForwardedIpcMessage,
} from "@bitwarden/common/platform/ipc";
import {
  IncomingMessage,
  IpcClient,
  IpcCommunicationBackend,
  ipcRegisterDiscoverHandler,
  OutgoingMessage,
} from "@bitwarden/sdk-internal";

export class IpcRendererService extends IpcService {
  private logService = inject(LogService);
  private platformUtilsService = inject(PlatformUtilsService);
  private communicationBackend?: IpcCommunicationBackend;

  override async init() {
    try {
      // This function uses classes and functions defined in the SDK, so we need to wait for the SDK to load.
      await SdkLoadService.Ready;

      this.communicationBackend = new IpcCommunicationBackend({
        async send(message: OutgoingMessage): Promise<void> {
          if (message.destination === "DesktopRenderer") {
            throw new Error(
              `Destination not supported: ${message.destination} (cannot send messages to self)`,
            );
          }

          if (
            message.destination === "BrowserBackground" ||
            message.destination === "DesktopMain"
          ) {
            ipc.platform.ipcService.send({
              type: "bitwarden-ipc-message",
              message: {
                destination: message.destination,
                payload: [...message.payload],
                topic: message.topic,
              },
            } satisfies IpcMessage);
            return;
          }
        },
      });

      ipc.platform.ipcService.onMessage((message: ForwardedIpcMessage | IpcMessage) => {
        this.communicationBackend?.receive(
          new IncomingMessage(
            new Uint8Array(message.message.payload),
            message.message.destination,
            isForwardedIpcMessage(message) ? message.originalSource : "DesktopMain",
            message.message.topic,
          ),
        );
      });

      await super.initWithClient(new IpcClient(this.communicationBackend));

      if (this.platformUtilsService.isDev()) {
        await ipcRegisterDiscoverHandler(this.client, {
          version: await this.platformUtilsService.getApplicationVersion(),
        });
      }
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }
}
