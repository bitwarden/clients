import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import {
  IpcMessage,
  isIpcMessage,
  IpcService,
  isForwardedIpcMessage,
} from "@bitwarden/common/platform/ipc";
import {
  IpcCommunicationBackend,
  IncomingMessage,
  OutgoingMessage,
  ipcRegisterDiscoverHandler,
  ipcRequestDiscover,
  IpcClient,
} from "@bitwarden/sdk-internal";

import { BrowserApi } from "../browser/browser-api";

export class IpcBackgroundService extends IpcService {
  private communicationBackend?: IpcCommunicationBackend;
  private nativeMessagingPort?: browser.runtime.Port | chrome.runtime.Port;

  constructor(
    private logService: LogService,
    private platformUtilsService: PlatformUtilsService,
  ) {
    super();

    (global as any).ipc = {
      discoverMain: async () => {
        return await ipcRequestDiscover(this.client, "DesktopMain", AbortSignal.timeout(5000));
      },
      discoverRenderer: async () => {
        return await ipcRequestDiscover(this.client, "DesktopRenderer", AbortSignal.timeout(5000));
      },
    };
  }

  override async init() {
    try {
      this.connectNativeMessaging();

      // This function uses classes and functions defined in the SDK, so we need to wait for the SDK to load.
      await SdkLoadService.Ready;
      this.communicationBackend = new IpcCommunicationBackend({
        send: async (message: OutgoingMessage): Promise<void> => {
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

          if (message.destination === "DesktopMain" || message.destination === "DesktopRenderer") {
            this.nativeMessagingPort?.postMessage({
              type: "bitwarden-ipc-message",
              message: {
                destination: message.destination,
                payload: [...message.payload],
                topic: message.topic,
              },
            } satisfies IpcMessage);
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

      this.nativeMessagingPort?.onMessage.addListener((ipcMessage) => {
        if (!isIpcMessage(ipcMessage) && !isForwardedIpcMessage(ipcMessage)) {
          return;
        }

        this.communicationBackend?.receive(
          new IncomingMessage(
            new Uint8Array(ipcMessage.message.payload),
            ipcMessage.message.destination,
            isForwardedIpcMessage(ipcMessage) ? ipcMessage.originalSource : "DesktopMain",
            ipcMessage.message.topic,
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

  private connectNativeMessaging() {
    try {
      // TODO: This needs to handle the full complexity of native messaging connections,
      // including permissions, errors and disconnections.
      const port = BrowserApi.connectNative("com.8bit.bitwarden");
      this.nativeMessagingPort = port;
    } catch (e) {
      this.logService.error("[IPC] Native messaging connection failed", e);
    }
  }
}
