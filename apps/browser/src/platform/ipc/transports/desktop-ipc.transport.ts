import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcMessage, isIpcMessage, isForwardedIpcMessage } from "@bitwarden/common/platform/ipc";
import {
  IncomingMessage,
  OutgoingMessage,
  IpcClient,
  ipcRequestDiscover,
} from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../browser/browser-api";

// The interval at which the browser extension in the background tries to reconnect to the desktop app.
const RECONNECTION_INTERVAL_MS = 10_000;
// The timeout for the discover message sent to the desktop app when trying to connect. If the desktop app does not respond to the discover message within this time, the connection attempt is considered failed and will be retried after the reconnection interval.
const DISCOVER_MESSAGE_TIMEOUT_MS = 5_000;

/**
 * Transport for communicating with the Bitwarden Desktop App over native messaging.
 *
 * Owns the native messaging port lifecycle, including the discover handshake and automatic
 * reconnection when the connection fails or is lost. Handles the `DesktopMain` and
 * `DesktopRenderer` destinations.
 */
export class DesktopIpcTransport {
  private nativeMessagingPort?: browser.runtime.Port | chrome.runtime.Port;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private client: IpcClient,
    private logService: LogService,
    private receive: (message: IncomingMessage) => void,
  ) {}

  async send(message: OutgoingMessage): Promise<void> {
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
  }

  /**
   * Starts the transport, establishing the connection to the desktop app and automatically
   * retrying whenever the connection fails or is lost.
   */
  init() {
    void this.connect();
  }

  /**
   * Starts a connection to the desktop app. This function attempts to establish a connection with the desktop application
   * using native messaging. It will automatically retry and reconnect if the connection fails or is lost.
   */
  private async connect() {
    if (!(await BrowserApi.permissionsGranted(["nativeMessaging"]))) {
      return;
    }

    let port: browser.runtime.Port | chrome.runtime.Port | undefined;
    try {
      port = BrowserApi.connectNative("com.8bit.bitwarden");
      this.nativeMessagingPort = port;

      port.onMessage.addListener((ipcMessage) => {
        if (!isIpcMessage(ipcMessage) && !isForwardedIpcMessage(ipcMessage)) {
          return;
        }

        this.receive(
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

      try {
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
        this.logService.error("[IPC] Failed to handshake with Bitwarden Desktop App", e);
      }
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
      void this.connect();
    }, RECONNECTION_INTERVAL_MS);
  }
}
