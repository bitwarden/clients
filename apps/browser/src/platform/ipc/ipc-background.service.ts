import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import {
  IpcCommunicationBackend,
  OutgoingMessage,
  ipcRegisterDiscoverHandler,
  IpcClient,
} from "@bitwarden/sdk-internal";

import { BrowserApi } from "../browser/browser-api";

import { NativeMessagingTransport, SafariTransport, WebIpcTransport } from "./transports";

/** A transport responsible for communicating with the desktop app. */
interface DesktopTransport {
  connectToDesktop(): Promise<void> | void;
  send(message: OutgoingMessage): Promise<void>;
}

export class IpcBackgroundService extends IpcService {
  private communicationBackend?: IpcCommunicationBackend;
  private webTransport?: WebIpcTransport;
  private desktopTransport?: DesktopTransport;

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

      this.webTransport = new WebIpcTransport(() => this.communicationBackend, this.logService);
      this.desktopTransport = BrowserApi.isSafariApi
        ? new SafariTransport(() => this.communicationBackend, this.logService)
        : new NativeMessagingTransport(
            () => this.communicationBackend,
            () => this.client,
            this.logService,
          );

      this.communicationBackend = new IpcCommunicationBackend({
        send: async (message: OutgoingMessage): Promise<void> => {
          if (typeof message.destination === "object" && "Web" in message.destination) {
            await this.webTransport!.send(message);
            return;
          }

          if (message.destination === "DesktopMain" || message.destination === "DesktopRenderer") {
            try {
              await this.desktopTransport!.send(message);
            } catch (e) {
              this.logService.error("[IPC] Failed to send message via native messaging", e);
            }
            return;
          }

          throw new Error("Destination not supported.");
        },
      });

      this.webTransport.registerListener();

      await super.initWithClient(IpcClient.newWithSdkInMemorySessions(this.communicationBackend));
      await ipcRegisterDiscoverHandler(this.client, {
        version: await this.platformUtilsService.getApplicationVersion(),
      });

      await this.connectToDesktop();
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }

  /** Establishes the connection to the desktop app using the platform-appropriate transport. */
  private async connectToDesktop(): Promise<void> {
    await this.desktopTransport?.connectToDesktop();
  }
}
