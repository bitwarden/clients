import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { IpcClient } from "@bitwarden/sdk-internal";

import { BackgroundCommunicationBackend } from "./background-communication-backend";

export class IpcBackgroundService extends IpcService {
  private communicationProvider?: BackgroundCommunicationBackend;

  constructor(private logService: LogService) {
    super();
  }

  override async init() {
    try {
      // This function uses classes and functions defined in the SDK, so we need to wait for the SDK to load.
      await SdkLoadService.Ready;
      this.communicationProvider = new BackgroundCommunicationBackend();

      await super.initWithClient(new IpcClient(this.communicationProvider));
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }
}
