import { inject } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { Manager } from "@bitwarden/sdk-internal";

import { WebCommunicationProvider } from "./web-communication-provider";

export class WebIpcService extends IpcService {
  private logService = inject(LogService);
  private communicationProvider: WebCommunicationProvider;

  async init() {
    this.communicationProvider = new WebCommunicationProvider();
    this.manager = new Manager(this.communicationProvider);

    await super.init();
  }
}
