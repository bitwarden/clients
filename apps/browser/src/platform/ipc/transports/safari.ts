import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcCommunicationBackend, IncomingMessage, OutgoingMessage } from "@bitwarden/sdk-internal";

import { SafariApp } from "../../../browser/safariApp";

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

/**
 * Transport for communicating with the desktop app on Safari.
 *
 * Safari cannot maintain a persistent native messaging connection to the desktop, so messages are
 * sent through the Safari Swift module and desktop -> extension messages are received by polling a
 * buffered socket.
 */
export class SafariTransport {
  private pollTimeout?: ReturnType<typeof setTimeout>;
  private lastActivity = 0;

  constructor(
    private getCommunicationBackend: () => IpcCommunicationBackend | undefined,
    private logService: LogService,
  ) {}

  /** Starts polling the buffered socket for desktop -> extension messages. */
  connectToDesktop(): void {
    this.startPolling();
  }

  /** Sends a message to the desktop app via the Safari Swift module. */
  async send(message: OutgoingMessage): Promise<void> {
    this.lastActivity = Date.now();
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
  private startPolling(): void {
    if (this.pollTimeout != null) {
      return;
    }

    const poll = async () => {
      let received = false;
      try {
        received = await this.drainDesktopMessages();
      } catch (e) {
        this.logService.warning("[IPC] Safari desktop poll failed", e);
      }

      const active = received || Date.now() - this.lastActivity < SAFARI_ACTIVE_WINDOW_MS;
      this.pollTimeout = setTimeout(
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
      this.lastActivity = Date.now();
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
        this.getCommunicationBackend()?.receive(
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
