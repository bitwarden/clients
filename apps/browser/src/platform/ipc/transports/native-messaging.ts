import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcMessage, isIpcMessage, isForwardedIpcMessage } from "@bitwarden/common/platform/ipc";
import {
  IpcCommunicationBackend,
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
 * Transport for communicating with the desktop app over a persistent native messaging connection.
 *
 * Establishes a native messaging port to the desktop app, performs the discover handshake, and
 * automatically reconnects if the connection fails or is lost.
 */
export class NativeMessagingTransport {
  private port?: browser.runtime.Port | chrome.runtime.Port;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private getCommunicationBackend: () => IpcCommunicationBackend | undefined,
    private getClient: () => IpcClient,
    private logService: LogService,
  ) {}

  /** Sends a message to the desktop app over the native messaging port. */
  async send(message: OutgoingMessage): Promise<void> {
    this.port?.postMessage({
      type: "bitwarden-ipc-message",
      message: {
        destination: message.destination,
        payload: [...message.payload],
        topic: message.topic,
      },
    } satisfies IpcMessage);
  }

  /**
   * Starts a connection to the desktop app. This function attempts to establish a connection with the desktop application
   * using native messaging. It will automatically retry and reconnect if the connection fails or is lost.
   */
  async connectToDesktop(): Promise<void> {
    let port: browser.runtime.Port | chrome.runtime.Port | undefined;
    try {
      port = BrowserApi.connectNative("com.8bit.bitwarden");
      this.port = port;

      port.onMessage.addListener((ipcMessage) => {
        if (!isIpcMessage(ipcMessage) && !isForwardedIpcMessage(ipcMessage)) {
          return;
        }

        this.getCommunicationBackend()?.receive(
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
        this.port = undefined;
        this.scheduleReconnect();
      });

      // Ensure the desktop app is properly connected
      const version = await ipcRequestDiscover(
        this.getClient(),
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
      this.port = undefined;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer != null) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connectToDesktop();
    }, RECONNECTION_INTERVAL_MS);
  }
}
