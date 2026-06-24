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
  isReachabilityPing,
  isReachabilityPong,
  ReachabilityPing,
  ReachabilityPong,
  ReachabilityTracker,
} from "@bitwarden/common/platform/ipc/reachability";
import {
  Endpoint,
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

// The browser extension's only leader is the desktop app.
const DESKTOP_LEADER: Endpoint = "DesktopRenderer";

export class IpcBackgroundService extends IpcService {
  private communicationBackend?: IpcCommunicationBackend;
  private nativeMessagingPort?: browser.runtime.Port | chrome.runtime.Port;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  // Tracks liveness of the desktop app (and connected web tabs) via reachability ping/pong.
  private reachability = new ReachabilityTracker(undefined, (endpoint, active) => {
    if ((endpoint === "DesktopMain" || endpoint === "DesktopRenderer") && !active) {
      this.logService.warning("[IPC] Disconnected from Bitwarden Desktop App");
    }
  });
  private desktopPingTimer?: ReturnType<typeof setTimeout>;
  // Resolves the in-flight desktop reachability probe (see connectToDesktop) on the next pong or
  // disconnect.
  private resolveReachable?: (reachable: boolean) => void;

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
        // Reachability is a pure liveness lookup fed by the ping/pong loops; it never touches the
        // crypto channel. Only the desktop leader is probed; sends down to web tabs stay permissive
        // (dead tabs are handled by leader-side session pruning).
        isReachable: async (destination: Endpoint): Promise<boolean> => {
          if (destination === "DesktopMain" || destination === "DesktopRenderer") {
            return this.reachability.isActive(destination);
          }
          return true;
        },
      });

      BrowserApi.messageListener("platform.ipc", (message, sender) => {
        // Answer reachability pings from web vault tabs (the extension is web's leader). Reply with
        // a plaintext pong; this never enters the crypto pipeline.
        if (isReachabilityPing(message)) {
          if (sender.tab?.id !== undefined && sender.tab.id !== chrome.tabs.TAB_ID_NONE) {
            this.reachability.record({
              Web: {
                tab_id: sender.tab.id,
                document_id: sender.documentId ?? "",
                origin: sender.origin ?? "",
              },
            });
            void BrowserApi.tabSendMessage(
              { id: sender.tab.id } as chrome.tabs.Tab,
              { type: "bitwarden-reachability-pong" } satisfies ReachabilityPong,
              { frameId: 0 },
            );
          }
          return;
        }

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

      this.scheduleDesktopPing();
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }

  /**
   * Continuously pings the desktop app over the native messaging port (when connected). The desktop
   * replies with a pong, keeping the desktop endpoint "active" in the reachability tracker. The
   * cadence adapts based on whether the desktop is currently active.
   */
  private scheduleDesktopPing(): void {
    if (this.nativeMessagingPort != null) {
      try {
        this.nativeMessagingPort.postMessage({
          type: "bitwarden-reachability-ping",
        } satisfies ReachabilityPing);
      } catch (e) {
        this.logService.error("[IPC] Failed to send reachability ping to desktop", e);
      }
    }
    this.armDesktopPingTimer();
  }

  /**
   * (Re)arms the desktop ping timer at the current adaptive cadence. Called after sending a ping,
   * and again whenever a pong / IPC frame proves the desktop is live. Re-arming on liveness is what
   * lets recovery from a stale state tighten the cadence straight back to the active interval:
   * because the back-off interval is longer than the active window, sampling the cadence only at
   * ping-send time would leave the endpoint flapping stale↔active forever once it first went stale.
   */
  private armDesktopPingTimer(): void {
    if (this.desktopPingTimer != null) {
      clearTimeout(this.desktopPingTimer);
    }
    this.desktopPingTimer = setTimeout(
      () => this.scheduleDesktopPing(),
      this.reachability.intervalFor(DESKTOP_LEADER),
    );
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
        // Plaintext reachability pong from the desktop. Record liveness and stop — never forward
        // into the crypto pipeline.
        if (isReachabilityPong(ipcMessage)) {
          this.reachability.record(DESKTOP_LEADER);
          // Recovering from stale: re-arm at the (now active) cadence so the next ping lands
          // inside the active window instead of the longer back-off interval.
          this.armDesktopPingTimer();
          this.resolveReachable?.(true);
          return;
        }

        if (!isIpcMessage(ipcMessage) && !isForwardedIpcMessage(ipcMessage)) {
          return;
        }

        // Any inbound IPC frame from the desktop also proves liveness.
        this.reachability.record(DESKTOP_LEADER);
        this.armDesktopPingTimer();

        this.communicationBackend?.receive(
          new IncomingMessage(
            new Uint8Array(ipcMessage.message.payload),
            ipcMessage.message.destination,
            isForwardedIpcMessage(ipcMessage) ? ipcMessage.originalSource : "DesktopMain",
            ipcMessage.message.topic,
          ),
        );
      });

      // Register the disconnect handler before probing so that a disconnect during the probe
      // window (e.g. the desktop app closing) is still handled.
      port.onDisconnect.addListener(() => {
        // Reading runtime.lastError marks the disconnect error as handled, suppressing Chrome's
        // "Unchecked runtime.lastError: Native host has exited." console noise that otherwise fires
        // on every reconnect attempt while the desktop app is not running.
        void chrome.runtime.lastError;
        this.nativeMessagingPort = undefined;
        // Mark the desktop stale immediately; the "Disconnected" warning is emitted from the
        // reachability transition handler.
        this.reachability.invalidate(DESKTOP_LEADER);
        // Fail any in-flight reachability probe so connectToDesktop retries promptly.
        this.resolveReachable?.(false);
        this.scheduleReconnect();
      });

      // Confirm the desktop is reachable using the plaintext ping/pong, which the desktop main
      // process always answers (no crypto, and unlike the discover RPC it is not gated behind dev
      // builds). Only once reachable do we attempt anything that goes through the crypto channel.
      const reachable = await this.probeDesktopReachable(DISCOVER_MESSAGE_TIMEOUT_MS);
      if (!reachable) {
        throw new Error("Desktop did not respond to the reachability ping");
      }
      this.logService.info("[IPC] Connected to Bitwarden Desktop App");

      // Best-effort version discovery over the crypto channel. The handler is only registered on the
      // desktop renderer in dev builds, so a failure here must not tear down the (already confirmed
      // reachable) connection.
      try {
        const version = await ipcRequestDiscover(
          this.client,
          "DesktopRenderer",
          AbortSignal.timeout(DISCOVER_MESSAGE_TIMEOUT_MS),
        );
        this.logService.info(`[IPC] Bitwarden Desktop App version ${version.version}`);
      } catch {
        // Reachability is already confirmed via the ping; version discovery is optional.
      }
    } catch {
      // A failed connection attempt is expected while the desktop app is not running, so it is not
      // logged. Disconnect the port to avoid leaking the native port and its spawned desktop_proxy
      // process, then schedule a retry.
      port?.disconnect();
      this.nativeMessagingPort = undefined;
      this.scheduleReconnect();
    }
  }

  /**
   * Sends a single plaintext reachability ping over the native port and resolves `true` on the next
   * pong, or `false` on timeout / disconnect. Does not go through the crypto channel.
   */
  private probeDesktopReachable(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const done = (reachable: boolean) => {
        clearTimeout(timer);
        if (this.resolveReachable === done) {
          this.resolveReachable = undefined;
        }
        resolve(reachable);
      };
      const timer = setTimeout(() => done(false), timeoutMs);
      this.resolveReachable = done;
      try {
        this.nativeMessagingPort?.postMessage({
          type: "bitwarden-reachability-ping",
        } satisfies ReachabilityPing);
      } catch {
        done(false);
      }
    });
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
