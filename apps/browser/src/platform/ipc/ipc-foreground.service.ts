import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { InMemoryIpcSessionRepository, IpcService } from "@bitwarden/common/platform/ipc";
import {
  IncomingMessage,
  IpcClient,
  IpcCommunicationBackend,
  ipcRegisterDiscoverHandler,
  OutgoingMessage,
} from "@bitwarden/sdk-internal";

import { BackgroundIpcTransport } from "./transports";

/**
 * {@link IpcService} for extension pages (popup, popout, sidebar). All traffic goes to the
 * background, which addresses this page as `BrowserForeground { id }`.
 */
export class IpcForegroundService extends IpcService {
  private communicationBackend?: IpcCommunicationBackend;

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

      const sessionRepository = new InMemoryIpcSessionRepository();
      const transport = new BackgroundIpcTransport(
        (message: IncomingMessage) => this.communicationBackend?.receive(message),
        sessionRepository,
      );

      this.communicationBackend = new IpcCommunicationBackend({
        send: (message: OutgoingMessage) => transport.send(message),
      });

      await super.initWithClient(
        IpcClient.newWithClientManagedSessions(this.communicationBackend, sessionRepository),
      );

      await ipcRegisterDiscoverHandler(this.client, {
        version: await this.platformUtilsService.getApplicationVersion(),
      });
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }
}
