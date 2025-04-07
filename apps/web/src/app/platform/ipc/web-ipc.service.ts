import { inject } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { IpcClient } from "@bitwarden/sdk-internal";

import { WebCommunicationProvider } from "./web-communication-provider";

export class WebIpcService extends IpcService {
  private logService = inject(LogService);
  private communicationProvider?: WebCommunicationProvider;

  override async init() {
    try {
      // This function uses classes and functions defined in the SDK, so we need to wait for the SDK to load.
      await SdkLoadService.Ready;
      this.communicationProvider = new WebCommunicationProvider();

      await super.initWithClient(new IpcClient(this.communicationProvider));
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }
}
