import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  IpcMessage,
  isIpcMessage,
  isForwardedIpcMessage,
  isProxyConnectedMessage,
} from "@bitwarden/common/platform/ipc";
import {
  IncomingMessage,
  OutgoingMessage,
  IpcClient,
  ipcRequestDiscover,
} from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../browser/browser-api";

import { DESTINATION_UNREACHABLE_ERROR } from "./errors";

// The interval at which the browser extension in the background tries to reconnect to the desktop app.
const RECONNECTION_INTERVAL_MS = 10_000;
// How long to wait for the native messaging proxy to report a connection after the port is opened.
// If it does not connect within this time, the attempt is aborted and retried after the reconnection interval.
const CONNECTION_TIMEOUT_MS = 5_000;
// The timeout for the discover message sent to the desktop app when trying to connect. If the desktop app does not respond to the discover message within this time, the connection attempt is considered failed and will be retried after the reconnection interval.
const DISCOVER_MESSAGE_TIMEOUT_MS = 5_000;

type NativePort = browser.runtime.Port | chrome.runtime.Port;

/**
 * The lifecycle of the native messaging connection, modelled as a state machine
 *
 * - `disconnected` — no live port. The initial state and the state after any failure/disconnect.
 * - `connecting`   — the port is open but the proxy has not reported a connection yet. `ready`
 *                    resolves once the outcome is known (either the proxy connects, or the port
 *                    disconnects), so callers can await it without risking a permanent hang.
 * - `connected`    — the proxy has reported a connection and the port is ready to send messages.
 */
type ConnectionState =
  | { kind: "disconnected" }
  | { kind: "connecting"; port: NativePort; ready: Promise<void> }
  | { kind: "connected"; port: NativePort };

/**
 * Transport for communicating with the Bitwarden Desktop App over native messaging.
 *
 * Owns the native messaging port lifecycle, including the discover handshake and automatic
 * reconnection when the connection fails or is lost. Handles the `DesktopMain` and
 * `DesktopRenderer` destinations.
 */
export class DesktopIpcTransport {
  private _state: ConnectionState = { kind: "disconnected" };
  private reconnectTimer?: ReturnType<typeof setInterval>;

  constructor(
    private client: IpcClient,
    private logService: LogService,
    private receive: (message: IncomingMessage) => void,
  ) {}

  async send(message: OutgoingMessage): Promise<void> {
    // Wait out an in-flight connection attempt before deciding reachability.
    const state = this.currentState();
    if (state.kind === "connecting") {
      await state.ready;
    }

    const connected = this.currentState();
    if (connected.kind !== "connected") {
      throw new Error(DESTINATION_UNREACHABLE_ERROR);
    }

    connected.port.postMessage({
      type: "bitwarden-ipc-message",
      message: {
        destination: message.destination,
        payload: [...message.payload],
        topic: message.topic,
      },
    } satisfies IpcMessage);
  }

  /**
   * Starts the transport. Kicks off the periodic reconnect timer, which establishes the connection
   * to the desktop app and automatically retries whenever the connection fails or is lost.
   */
  init() {
    this.startReconnectTimer();
  }

  /**
   * Attempts to establish a connection with the desktop application using native messaging. Invoked
   * by the reconnect timer whenever the connection is down; no-ops unless currently disconnected.
   */
  private async connect() {
    // Only start from a clean slate; guards against overwriting a live port (which would leak the
    // previous native port and its spawned desktop_proxy process).
    if (this.currentState().kind !== "disconnected") {
      return;
    }

    if (!(await BrowserApi.permissionsGranted(["nativeMessaging"]))) {
      return;
    }

    let activePort: NativePort | undefined;
    try {
      const port = BrowserApi.connectNative("com.8bit.bitwarden");
      activePort = port;

      let resolveReady: () => void;
      const ready = new Promise<void>((resolve) => {
        resolveReady = resolve;
      });
      this.setState({ kind: "connecting", port, ready });

      port.onMessage.addListener((ipcMessage: any) => {
        if (isProxyConnectedMessage(ipcMessage)) {
          this.setState({ kind: "connected", port });
          resolveReady();
          this.logService.info("[IPC] Connected to Bitwarden Desktop App Transport");
        }

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
        if (this.currentState().kind === "connected") {
          this.logService.warning("[IPC] Disconnected from Bitwarden Desktop App Transport");
        }

        this.setState({ kind: "disconnected" });
        // Unblock anyone waiting on the connection attempt (both connect() and send()).
        resolveReady();

        // Suppress error message
        void chrome.runtime.lastError;
      });

      // Wait for the proxy to report a connection, bounded by a timeout so a proxy that opens the
      // port but never reports a connection (and never disconnects) can't leave us stuck here forever.
      await Promise.race([
        ready,
        new Promise<void>((resolve) => setTimeout(resolve, CONNECTION_TIMEOUT_MS)),
      ]);

      if (this.currentState().kind !== "connected") {
        // Either we timed out waiting for the proxy, or the port disconnected mid-attempt.
        // Explicitly tear down the port
        port.disconnect();
        this.setState({ kind: "disconnected" });
        return;
      }

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
      activePort?.disconnect();
      this.setState({ kind: "disconnected" });
    }
  }

  private currentState(): ConnectionState {
    return this._state;
  }

  private setState(state: ConnectionState) {
    this._state = state;
  }

  // Runs a single long-lived timer that re-invokes connect() while the connection is down, plus one
  // immediate attempt so the first connection isn't delayed by a full interval. connect() itself
  // no-ops unless the state is `disconnected`, so ticks during an active/in-flight connection are
  // harmless. Idempotent: repeated calls keep the one existing timer.
  private startReconnectTimer() {
    if (this.reconnectTimer != null) {
      return;
    }
    void this.connect();
    this.reconnectTimer = setInterval(() => {
      if (this.currentState().kind === "disconnected") {
        void this.connect();
      }
    }, RECONNECTION_INTERVAL_MS);
  }
}
