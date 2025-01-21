import { firstValueFrom } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { IpcService, PingMessagePayload, PongMessagePayload } from "@bitwarden/common/platform/ipc";
import { Destination, Manager } from "@bitwarden/sdk-internal";

import { BackgroundCommunicationProvider } from "./background-communication-provider";

export class IpcBackgroundService extends IpcService {
  private communicationProvider: BackgroundCommunicationProvider;

  constructor(private sdkService: SdkService) {
    super();
  }

  override async init() {
    try {
      // Hack to initialize WASM
      // TODO: remove when https://github.com/bitwarden/clients/pull/12764 is merged
      await firstValueFrom(this.sdkService.client$);
      this.communicationProvider = new BackgroundCommunicationProvider();
      this.manager = new Manager(this.communicationProvider);

      await super.init();

      // TODO: Remove pong - this is simply a proof of concept
      this.messages$.subscribe((message) => {
        if (
          message.data[0] === PingMessagePayload[0] &&
          message.data[1] === PingMessagePayload[1]
        ) {
          // eslint-disable-next-line no-console
          console.log("[IPC] Received ping");
          void this.pong(message.source);
        }
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[IPC] Initialization failed", e);
    }
  }

  async pong(destination: Destination) {
    try {
      // eslint-disable-next-line no-console
      console.log("[IPC] Ponging");
      await this.manager.send({
        destination,
        // TODO: Fix hacky hack
        data: PongMessagePayload as any as number[],
        source: undefined,
      });
      // eslint-disable-next-line no-console
      console.log("[IPC] Sent pong");
    } catch (error) {
      if (typeof error.debug === "function") {
        // eslint-disable-next-line no-console
        return console.error("[IPC] Pong failed", error.debug());
      }

      // eslint-disable-next-line no-console
      console.error("[IPC] Ping failed", error);
    }
  }
}
