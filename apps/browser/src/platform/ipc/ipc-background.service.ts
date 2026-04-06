import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcMessage, isIpcMessage, IpcService } from "@bitwarden/common/platform/ipc";
import {
  IpcCommunicationBackend,
  IncomingMessage,
  OutgoingMessage,
  ipcRegisterDiscoverHandler,
  IpcClient,
  IpcSessionRepository,
} from "@bitwarden/sdk-internal";

import { BrowserApi } from "../browser/browser-api";

export class IpcBackgroundService extends IpcService {
  private communicationBackend?: IpcCommunicationBackend;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
    private sessionRepository: IpcSessionRepository,
  ) {
    super();
  }

  override async init() {
    try {
      // This function uses classes and functions defined in the SDK, so we need to wait for the SDK to load.
      await SdkLoadService.Ready;
      this.communicationBackend = new IpcCommunicationBackend({
        async send(message: OutgoingMessage): Promise<void> {
          if (typeof message.destination === "object" && message.destination.Web != undefined) {
            await BrowserApi.tabSendMessage(
              { id: message.destination.Web.id } as chrome.tabs.Tab,
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
            return;
          }

          throw new Error("Destination not supported.");
        },
      });

      BrowserApi.messageListener("platform.ipc", (message, sender) => {
        if (!isIpcMessage(message) || message.message.destination !== "BrowserBackground") {
          return;
        }

        if (sender.tab?.id === undefined || sender.tab.id === chrome.tabs.TAB_ID_NONE) {
          // Ignore messages from non-tab sources
          return;
        }

        this.communicationBackend?.receive(
          new IncomingMessage(
            new Uint8Array(message.message.payload),
            message.message.destination,
            {
              Web: { id: sender.tab.id },
            },
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
