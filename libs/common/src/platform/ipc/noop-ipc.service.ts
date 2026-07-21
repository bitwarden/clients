import { IpcClient, IpcCommunicationBackend, OutgoingMessage } from "@bitwarden/sdk-internal";

import { LogService } from "../abstractions/log.service";
import { SdkLoadService } from "../abstractions/sdk/sdk-load.service";

import { IpcService } from "./ipc.service";

/**
 * No-op {@link IpcService} used as a placeholder where a real IPC transport is
 * not yet available (e.g. the desktop renderer). The underlying {@link IpcClient}
 * is real so that consumers calling `ipcRegister*Handlers` succeed, but outgoing
 * messages are dropped and no inbound transport is wired up.
 */
export class NoopIpcService extends IpcService {
  constructor(private logService: LogService) {
    super();
  }

  override async init() {
    try {
      await SdkLoadService.Ready;

      const communicationBackend = new IpcCommunicationBackend({
        send: async (_message: OutgoingMessage): Promise<void> => {
          this.logService.info("[IPC] Noop transport dropping message", _message);
          // Drop the message. No transport is available in this environment.
        },
      });

      await super.initWithClient(IpcClient.newWithSdkInMemorySessions(communicationBackend));
    } catch (e) {
      this.logService.error("[IPC] Noop initialization failed", e);
    }
  }
}
