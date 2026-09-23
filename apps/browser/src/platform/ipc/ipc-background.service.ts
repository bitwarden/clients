import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import {
  IpcCommunicationBackend,
  IncomingMessage,
  OutgoingMessage,
  ipcRegisterDiscoverHandler,
  IpcClient,
} from "@bitwarden/sdk-internal";

import { DesktopIpcTransport, WebIpcTransport } from "./transports";

export class IpcBackgroundService extends IpcService {
  private communicationBackend?: IpcCommunicationBackend;
  private webTransport?: WebIpcTransport;
  private desktopTransport?: DesktopIpcTransport;

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

      const receive = (message: IncomingMessage) => this.communicationBackend?.receive(message);

      this.communicationBackend = new IpcCommunicationBackend({
        send: async (message: OutgoingMessage): Promise<void> => {
          if (
            typeof message.destination === "object" &&
            "Web" in message.destination &&
            this.webTransport != null
          ) {
            await this.webTransport!.send(message);
            return;
          }

          if (
            (message.destination === "DesktopMain" || message.destination === "DesktopRenderer") &&
            this.desktopTransport != null
          ) {
            await this.desktopTransport!.send(message);
            return;
          }

          throw new Error("Destination not supported.");
        },
      });

      if (!this.platformUtilsService.isFirefox()) {
        this.webTransport = new WebIpcTransport(this.logService, receive);
        this.webTransport.init();
      }

      await super.initWithClient(IpcClient.newWithSdkInMemorySessions(this.communicationBackend));

      await ipcRegisterDiscoverHandler(this.client, {
        version: await this.platformUtilsService.getApplicationVersion(),
      });

      if (!this.platformUtilsService.isSafari()) {
        this.desktopTransport = new DesktopIpcTransport(this.client, this.logService, receive);
        this.desktopTransport.init();
      }
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }
}
