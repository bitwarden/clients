import { inject } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { Manager } from "@bitwarden/sdk-internal";

import { BackgroundCommunicationProvider } from "./background-communication-provider";

export class IpcBackgroundService extends IpcService {
  private logService = inject(LogService);
  private communicationProvider: BackgroundCommunicationProvider;

  override async init() {
    try {
      this.communicationProvider = new BackgroundCommunicationProvider();
      this.manager = new Manager(this.communicationProvider);

      await super.init();
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }
}
