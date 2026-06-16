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

import { SafariApp } from "../../browser/safariApp";
import { BrowserApi } from "../browser/browser-api";

/** Poll interval while the channel is active (a recent send, or messages just arrived). */
const SAFARI_FAST_POLL_MS = 200;
/** Idle heartbeat so desktop-initiated pushes (e.g. shared unlock) arrive promptly. */
const SAFARI_IDLE_POLL_MS = 1000;
/** How long after activity to keep polling fast. */
const SAFARI_ACTIVE_WINDOW_MS = 5000;

/** Envelope serialized over the buffered Safari socket. Payloads are opaque (SDK-encrypted). */
interface SafariIpcEnvelope {
  destination: unknown;
  source?: unknown;
  payload: number[];
  topic?: string;
}

export class IpcBackgroundService extends IpcService {
  private communicationBackend?: IpcCommunicationBackend;
  private safariPollTimeout?: ReturnType<typeof setTimeout>;
  private safariLastActivity = 0;

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

          // On Safari, the desktop is reachable only over the buffered App Group socket. The
          // generic (Chrome/Firefox) desktop transport is built separately.
          if (
            (message.destination === "DesktopMain" || message.destination === "DesktopRenderer") &&
            BrowserApi.isSafariApi
          ) {
            await this.sendToDesktopViaSafari(message);
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

      // Safari cannot maintain a persistent connection to the desktop, so we poll the buffered
      // socket to receive desktop -> extension messages.
      if (BrowserApi.isSafariApi) {
        this.startSafariDesktopPolling();
      }
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }

  private async sendToDesktopViaSafari(message: OutgoingMessage): Promise<void> {
    this.safariLastActivity = Date.now();
    const envelope: SafariIpcEnvelope = {
      destination: message.destination,
      payload: [...message.payload],
      topic: message.topic,
    };
    await SafariApp.sendMessageToApp("sendMessage", JSON.stringify(envelope));
  }

  /**
   * Repeatedly drain the buffered socket. Polls fast while the channel is active and falls back to
   * an idle heartbeat otherwise. Each poll spawns Safari's native handler, so the idle cadence is a
   * deliberate trade-off between latency and overhead / power-consumption.
   */
  private startSafariDesktopPolling(): void {
    if (this.safariPollTimeout != null) {
      return;
    }

    const poll = async () => {
      let received = false;
      try {
        received = await this.drainDesktopMessages();
      } catch (e) {
        this.logService.warning("[IPC] Safari desktop poll failed", e);
      }

      const active = received || Date.now() - this.safariLastActivity < SAFARI_ACTIVE_WINDOW_MS;
      this.safariPollTimeout = setTimeout(
        () => void poll(),
        active ? SAFARI_FAST_POLL_MS : SAFARI_IDLE_POLL_MS,
      );
    };

    void poll();
  }

  /** Drain and pipe to the SDK ipc framework the desktop -> extension messages. Returns whether any were received. */
  private async drainDesktopMessages(): Promise<boolean> {
    const response = await SafariApp.sendMessageToApp("receiveMessage");
    const messages: string[] = response?.messages ?? [];
    if (messages.length > 0) {
      this.safariLastActivity = Date.now();
      this.logService.info(`[IPC] Safari drained ${messages.length} message(s):`, messages);
    }

    for (const raw of messages) {
      let envelope: SafariIpcEnvelope;
      try {
        envelope = JSON.parse(raw) as SafariIpcEnvelope;
      } catch (e) {
        this.logService.warning("[IPC] Dropping malformed desktop message", e);
        continue;
      }

      try {
        this.communicationBackend?.receive(
          new IncomingMessage(
            new Uint8Array(envelope.payload),
            envelope.destination as IncomingMessage["destination"],
            "DesktopMain",
            envelope.topic,
          ),
        );
      } catch (e) {
        this.logService.warning("[IPC] Failed to dispatch desktop message", e);
      }
    }

    return messages.length > 0;
  }
}
