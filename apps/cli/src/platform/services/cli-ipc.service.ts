import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import {
  IncomingMessage,
  IpcClient,
  IpcCommunicationBackend,
  OutgoingMessage,
  ipcRequestDiscover,
} from "@bitwarden/sdk-internal";

import { CliDesktopIpcTransport } from "./cli-desktop-ipc.transport";

const DESKTOP_DISCOVER_TIMEOUT_MS = 5_000;
export const MINIMUM_BIOMETRIC_DESKTOP_VERSION = "2026.7.0";

/** SDK IPC service backed by the desktop app's local socket. */
export class CliIpcService extends IpcService {
  private communicationBackend?: IpcCommunicationBackend;
  private transport?: CliDesktopIpcTransport;
  private initialization?: Promise<void>;
  private desktopVerification?: Promise<string>;

  constructor(private logService: LogService) {
    super();
  }

  override init(): Promise<void> {
    this.initialization ??= this.initialize();
    return this.initialization;
  }

  disconnect(): void {
    this.desktopVerification = undefined;
    this.transport?.disconnect();
  }

  /**
   * Verifies that the connected desktop understands the SDK IPC protocol before
   * sending a biometric request. Older desktop versions expose the same socket,
   * but do not respond to SDK IPC messages.
   */
  async verifyDesktopConnection(): Promise<string> {
    await this.init();

    this.desktopVerification ??= this.discoverDesktop();
    return await this.desktopVerification;
  }

  private async discoverDesktop(): Promise<string> {
    try {
      const response = await ipcRequestDiscover(
        this.client,
        "DesktopRenderer",
        AbortSignal.timeout(DESKTOP_DISCOVER_TIMEOUT_MS),
      );
      return response.version;
    } catch (error) {
      this.disconnect();
      const details = error instanceof Error ? ` ${error.message}` : "";
      throw new Error(
        `Could not establish SDK IPC with Bitwarden Desktop. Biometric unlock requires Bitwarden Desktop ${MINIMUM_BIOMETRIC_DESKTOP_VERSION} or newer.${details}`,
      );
    }
  }

  private async initialize(): Promise<void> {
    await SdkLoadService.Ready;

    const receive = (message: IncomingMessage) => this.communicationBackend?.receive(message);
    this.transport = new CliDesktopIpcTransport(
      this.logService,
      receive,
      undefined,
      () => (this.desktopVerification = undefined),
    );
    this.communicationBackend = new IpcCommunicationBackend({
      send: async (message: OutgoingMessage): Promise<void> => {
        if (message.destination !== "DesktopMain" && message.destination !== "DesktopRenderer") {
          throw new Error("CLI IPC only supports Bitwarden Desktop destinations");
        }
        await this.transport!.send(message);
      },
    });

    // The desktop native IPC server currently assigns direct socket clients a
    // BrowserBackground client ID. A first-class CLI endpoint will require a
    // corresponding Desktop change.
    await super.initWithClient(IpcClient.newWithSdkInMemorySessions(this.communicationBackend));
  }
}
