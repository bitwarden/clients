import { IpcService } from "@bitwarden/common/platform/ipc";
import { IpcClient } from "@bitwarden/sdk-internal";

import { WebCommunicationProvider } from "./web-communication-provider";

export class WebIpcService extends IpcService {
  private communicationProvider: WebCommunicationProvider;

  async init() {
    this.communicationProvider = new WebCommunicationProvider();
    this.client = new IpcClient(this.communicationProvider);

    await super.init();
  }
}
