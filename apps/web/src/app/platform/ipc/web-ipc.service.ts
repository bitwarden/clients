import { inject } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import {
  IpcMessage,
  IpcService,
  isIpcMessage,
  IpcSessionRepository,
} from "@bitwarden/common/platform/ipc";
import {
  IncomingMessage,
  IpcClient,
  IpcCommunicationBackend,
  ipcRegisterDiscoverHandler,
  OutgoingMessage,
} from "@bitwarden/sdk-internal";

export class WebIpcService extends IpcService {
  private logService = inject(LogService);
  private platformUtilsService = inject(PlatformUtilsService);
  private sessionRepository = inject(IpcSessionRepository);
  private communicationBackend?: IpcCommunicationBackend;

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
                message: {
                  destination: message.destination,
                  payload: [...message.payload],
                  topic: message.topic,
                },
              } satisfies IpcMessage,
              window.location.origin,
            );
            return;
          }

          throw new Error(`Destination not supported: ${message.destination}`);
        },
      });

      window.addEventListener("message", async (event: MessageEvent) => {
        if (event.origin !== window.origin) {
          return;
        }

        const message = event.data;
        if (!isIpcMessage(message)) {
          return;
        }

        if (
          typeof message.message.destination !== "object" ||
          message.message.destination.Web == undefined
        ) {
          return;
        }

        this.communicationBackend?.receive(
          new IncomingMessage(
            new Uint8Array(message.message.payload),
            message.message.destination,
            "BrowserBackground",
            message.message.topic,
          ),
        );
      });

      await super.initWithClient(
        IpcClient.newWithClientManagedSessions(this.communicationBackend, this.sessionRepository),
      );

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
