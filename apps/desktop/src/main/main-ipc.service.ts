import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import {
  IpcClient,
  IpcCommunicationBackend,
  IncomingMessage,
  OutgoingMessage,
} from "@bitwarden/sdk-internal";

import { SafariIpcMain } from "./safari-ipc.main";

/** Envelope serialized over the buffered Safari socket. Payloads are opaque (SDK-encrypted). */
interface SafariIpcEnvelope {
  destination: unknown;
  source?: unknown;
  payload: number[];
  topic?: string;
}

/**
 * Desktop main-process {@link IpcService}. This will take both Safari and non-Safari (firefox/chromium/CLI) messages.
 */
export class MainIpcService extends IpcService {
  private communicationBackend?: IpcCommunicationBackend;

  constructor(
    private logService: LogService,
    private safariIpcMain: SafariIpcMain,
  ) {
    super();
  }

  override async init() {
    try {
      await SdkLoadService.Ready;

      this.communicationBackend = new IpcCommunicationBackend({
        send: async (message: OutgoingMessage): Promise<void> => {
          const envelope: SafariIpcEnvelope = {
            destination: message.destination,
            payload: [...message.payload],
            topic: message.topic,
          };
          this.safariIpcMain.enqueue(JSON.stringify(envelope));
        },
      });

      this.safariIpcMain.setMessageHandler((raw) => this.receive(raw));

      await super.initWithClient(IpcClient.newWithSdkInMemorySessions(this.communicationBackend));
    } catch (e) {
      this.logService.error("[IPC] Safari IPC initialization failed", e);
    }
  }

  private receive(raw: string): void {
    let envelope: SafariIpcEnvelope;
    try {
      envelope = JSON.parse(raw) as SafariIpcEnvelope;
    } catch (e) {
      this.logService.warning("[IPC] Dropping malformed Safari message", e);
      return;
    }

    try {
      this.communicationBackend?.receive(
        new IncomingMessage(
          new Uint8Array(envelope.payload),
          envelope.destination as IncomingMessage["destination"],
          (envelope.source ?? { BrowserBackground: { id: "Own" } }) as IncomingMessage["source"],
          envelope.topic,
        ),
      );
    } catch (e) {
      this.logService.warning("[IPC] Failed to dispatch Safari message", e);
    }
  }
}
