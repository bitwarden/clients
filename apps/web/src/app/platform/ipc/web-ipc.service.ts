import { inject } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import {
  DESTINATION_UNREACHABLE_ERROR,
  IpcMessage,
  IpcService,
  isIpcMessage,
} from "@bitwarden/common/platform/ipc";
import {
  IncomingMessage,
  IpcClient,
  IpcCommunicationBackend,
  ipcRegisterDiscoverHandler,
  OutgoingMessage,
} from "@bitwarden/sdk-internal";

import { WebBrowserInteractionService } from "../../vault/services/web-browser-interaction.service";

export class WebIpcService extends IpcService {
  private logService = inject(LogService);
  private platformUtilsService = inject(PlatformUtilsService);
  private webBrowserInteractionService = inject(WebBrowserInteractionService);
  private communicationBackend?: IpcCommunicationBackend;
  /** Whether the browser extension is installed. Until it is, nothing answers a send to it. */
  private extensionInstalled = false;

  override async init() {
    try {
      // This function uses classes and functions defined in the SDK, so we need to wait for the SDK to load.
      await SdkLoadService.Ready;

      this.webBrowserInteractionService.extensionInstalled$.subscribe((installed) => {
        this.extensionInstalled = installed;
      });

      this.communicationBackend = new IpcCommunicationBackend({
        send: async (message: OutgoingMessage): Promise<void> => {
          if (
            typeof message.destination === "object" &&
            "BrowserBackground" in message.destination
          ) {
            // Fail fast instead of posting into the void: the SDK would otherwise wait out its
            // handshake timeout for a reply that never comes. The Firefox extension runs no web
            // IPC, so it never answers even when installed.
            if (!this.extensionInstalled || this.platformUtilsService.isFirefox()) {
              throw new Error(DESTINATION_UNREACHABLE_ERROR);
            }

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

          throw new Error(`Destination not supported: ${JSON.stringify(message.destination)}`);
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
          !("Web" in message.message.destination)
        ) {
          return;
        }

        this.communicationBackend?.receive(
          new IncomingMessage(
            new Uint8Array(message.message.payload),
            message.message.destination,
            { BrowserBackground: { id: "Own" } },
            message.message.topic,
          ),
        );
      });

      await super.initWithClient(IpcClient.newWithSdkInMemorySessions(this.communicationBackend));

      await ipcRegisterDiscoverHandler(this.client, {
        version: await this.platformUtilsService.getApplicationVersion(),
      });
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }
}
