import { inject } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcMessage, IpcService, isIpcMessage } from "@bitwarden/common/platform/ipc";
import {
  isReachabilityPong,
  ReachabilityPing,
  ReachabilityTracker,
} from "@bitwarden/common/platform/ipc/reachability";
import {
  Endpoint,
  IncomingMessage,
  IpcClient,
  IpcCommunicationBackend,
  ipcRegisterDiscoverHandler,
  OutgoingMessage,
} from "@bitwarden/sdk-internal";

// Web's only leader is the browser extension background.
const LEADER: Endpoint = { BrowserBackground: { id: "Own" } };

export class WebIpcService extends IpcService {
  private logService = inject(LogService);
  private platformUtilsService = inject(PlatformUtilsService);
  private communicationBackend?: IpcCommunicationBackend;
  // Tracks liveness of the browser extension via the reachability ping/pong below.
  private reachability = new ReachabilityTracker();

  override async init() {
    try {
      // This function uses classes and functions defined in the SDK, so we need to wait for the SDK to load.
      await SdkLoadService.Ready;

      const reachability = this.reachability;
      this.communicationBackend = new IpcCommunicationBackend({
        async send(message: OutgoingMessage): Promise<void> {
          if (
            typeof message.destination === "object" &&
            "BrowserBackground" in message.destination
          ) {
            window.postMessage(
              {
                type: "bitwarden-ipc-message",
                message: {
                  destination: message.destination,
                  payload: [...message.payload],
                  topic: message.topic,
                },
              } satisfies IpcMessage,
              window.location.origin,
            );
            return;
          }

          throw new Error(`Destination not supported: ${JSON.stringify(message.destination)}`);
        },
        // Reachability is a pure liveness lookup fed by the ping/pong loop below; it never touches
        // the crypto channel.
        async isReachable(destination: Endpoint): Promise<boolean> {
          return reachability.isActive(destination);
        },
      });

      window.addEventListener("message", async (event: MessageEvent) => {
        if (event.origin !== window.origin) {
          return;
        }

        const message = event.data;

        // Plaintext reachability pong from the extension. Record liveness and stop — this must not
        // be forwarded into the crypto pipeline.
        if (isReachabilityPong(message)) {
          this.reachability.record(LEADER);
          return;
        }

        if (!isIpcMessage(message)) {
          return;
        }

        if (
          typeof message.message.destination !== "object" ||
          !("Web" in message.message.destination)
        ) {
          return;
        }

        // Any inbound IPC frame from the extension also proves liveness.
        this.reachability.record(LEADER);

        this.communicationBackend?.receive(
          new IncomingMessage(
            new Uint8Array(message.message.payload),
            message.message.destination,
            { BrowserBackground: { id: "Own" } },
            message.message.topic,
          ),
        );
      });

      await super.initWithClient(IpcClient.newWithSdkInMemorySessions(this.communicationBackend));

      await ipcRegisterDiscoverHandler(this.client, {
        version: await this.platformUtilsService.getApplicationVersion(),
      });

      this.scheduleReachabilityPing();
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }

  /**
   * Continuously pings the browser extension. The extension's content script relays the ping to the
   * background, which replies with a pong; the ping cadence adapts based on whether the extension is
   * currently active (see {@link ReachabilityTracker}).
   */
  private scheduleReachabilityPing(): void {
    window.postMessage(
      { type: "bitwarden-reachability-ping" } satisfies ReachabilityPing,
      window.location.origin,
    );
    setTimeout(() => this.scheduleReachabilityPing(), this.reachability.intervalFor(LEADER));
  }
}
