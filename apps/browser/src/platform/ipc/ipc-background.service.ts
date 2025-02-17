import { inject } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { IpcClient } from "@bitwarden/sdk-internal";

import { BackgroundCommunicationBackend } from "./background-communication-backend";

export class IpcBackgroundService extends IpcService {
  private logService = inject(LogService);
  private communicationProvider: BackgroundCommunicationBackend;

  override async init() {
    try {
      this.communicationProvider = new BackgroundCommunicationBackend();
      this.client = new IpcClient(this.communicationProvider);

      await super.init();
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }
}
