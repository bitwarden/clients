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
  IpcClient,
  ipcRequestDiscover,
} from "@bitwarden/sdk-internal";

import { BrowserApi } from "../browser/browser-api";

// The interval at which the browser extension in the background tries to reconnect to the desktop app.
const RECONNECTION_INTERVAL_MS = 10_000;
// The timeout for the discover message sent to the desktop app when trying to connect. If the desktop app does not respond to the discover message within this time, the connection attempt is considered failed and will be retried after the reconnection interval.
const DISCOVER_MESSAGE_TIMEOUT_MS = 5_000;

export class IpcBackgroundService extends IpcService {
  private communicationBackend?: IpcCommunicationBackend;
  private nativeMessagingPort?: browser.runtime.Port | chrome.runtime.Port;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
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
            // Verify the document hasn't changed (e.g., user navigated away) before delivering.
            // If the browser doesn't support documentId on getFrame, skip the check and send anyway.
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

          if (message.destination === "DesktopMain" || message.destination === "DesktopRenderer") {
            try {
              this.nativeMessagingPort?.postMessage({
                type: "bitwarden-ipc-message",
                message: {
                  destination: message.destination,
                  payload: [...message.payload],
                  topic: message.topic,
                },
              } satisfies IpcMessage);
            } catch (e) {
              this.logService.error("[IPC] Failed to send message via native messaging", e);
            }
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

      await super.initWithClient(IpcClient.newWithSdkInMemorySessions(this.communicationBackend));

      await ipcRegisterDiscoverHandler(this.client, {
        version: await this.platformUtilsService.getApplicationVersion(),
      });

      await this.connectToDesktop();
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }

  /**
   * Starts a connection to the desktop app. This function attempts to establish a connection with the desktop application
   * using native messaging. It will automaticall retry and reconnect if the connection fails or is lost.
   */
  private async connectToDesktop() {
    let port: browser.runtime.Port | chrome.runtime.Port | undefined;
    try {
      port = BrowserApi.connectNative("com.8bit.bitwarden");
      this.nativeMessagingPort = port;

      port.onMessage.addListener((ipcMessage) => {
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

      // Register the disconnect handler before awaiting the discover handshake so that a
      // disconnect during the handshake window (e.g. the desktop app closing) is still handled.
      port.onDisconnect.addListener(() => {
        this.logService.warning("[IPC] Disconnected from Bitwarden Desktop App");
        this.nativeMessagingPort = undefined;
        this.scheduleReconnect();
      });

      // Ensure the desktop app is properly connected
      const version = await ipcRequestDiscover(
        this.client,
        "DesktopRenderer",
        AbortSignal.timeout(DISCOVER_MESSAGE_TIMEOUT_MS),
      );
      this.logService.info(
        `[IPC] Connected to Bitwarden Desktop App with version ${version.version}`,
      );
    } catch (e) {
      this.logService.error("[IPC] Failed to connect to Bitwarden Desktop App", e);
      // Explicitly disconnect the port to avoid leaking the native port and its spawned
      // desktop_proxy process when the handshake fails (e.g. the desktop app is unreachable).
      port?.disconnect();
      this.nativeMessagingPort = undefined;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer != null) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connectToDesktop();
    }, RECONNECTION_INTERVAL_MS);
  }
}
