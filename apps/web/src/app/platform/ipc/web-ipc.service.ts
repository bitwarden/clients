import { filter, firstValueFrom } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { IpcService, PingMessagePayload, PongMessagePayload } from "@bitwarden/common/platform/ipc";
import { Manager } from "@bitwarden/sdk-internal";

import { WebCommunicationProvider } from "./web-communication-provider";

export class WebIpcService extends IpcService {
  private communicationProvider: WebCommunicationProvider;

  constructor(private sdkService: SdkService) {
    super();
  }

  async init() {
    // Hack to initialize WASM
    // TODO: remove when https://github.com/bitwarden/clients/pull/12764 is merged
    await firstValueFrom(this.sdkService.client$);

    this.communicationProvider = new WebCommunicationProvider();
    this.manager = new Manager(this.communicationProvider);

    await super.init();

    // TODO: remove
    void this.ping();
  }

  async ping() {
    try {
      // eslint-disable-next-line no-console
      console.log("[IPC] Pinging");
      await this.manager.send({
        destination: "BrowserBackground",
        // TODO: Fix hacky hack
        data: PingMessagePayload as any as number[],
        source: undefined,
      });
      // eslint-disable-next-line no-console
      console.log("[IPC] Sent ping");

      const pong = await firstValueFrom(
        this.messages$.pipe(
          filter(
            (message) =>
              message.data[0] === PongMessagePayload[0] &&
              message.data[1] === PongMessagePayload[1],
          ),
        ),
      );
      // eslint-disable-next-line no-console
      console.log("[IPC] Received pong", pong);
    } catch (error) {
      // Doesn't work for some reason?
      // if (error instanceof SendError) {
      if (typeof error.debug === "function") {
        // eslint-disable-next-line no-console
        return console.error("[IPC] Ping failed", error.debug());
      }

      // eslint-disable-next-line no-console
      console.error("[IPC] Ping failed", error);
    }
  }
}
