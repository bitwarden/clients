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
        send: async (message: OutgoingMessage): Promise<void> => {
          if (typeof message.destination === "object" && "Web" in message.destination) {
            try {
              const frame = await chrome.webNavigation.getFrame({
                tabId: message.destination.Web.tab_id,
                frameId: 0,
              });
              if (
                frame?.documentId != null &&
                frame.documentId !== message.destination.Web.document_id
              ) {
                this.logService.warning("[IPC] Dropping message to Web tab: document has changed");
                return;
              }
            } catch {
              // Tab may have been closed, or API not available. Drop the message.
              this.logService.warning(
                "[IPC] Dropping message to Web tab: tab no longer accessible",
              );
              return;
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
            return;
          }

          throw new Error("Destination not supported.");
        },
      });

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

        this.communicationBackend?.receive(
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
