import { lt } from "semver";

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
export const MINIMUM_BIOMETRIC_DESKTOP_VERSION = "2026.9.0";
export const IPC_SOCKET_DIR_ENV = "BITWARDEN_IPC_SOCKET_DIR";

/** SDK IPC service backed by the Bitwarden Desktop native-messaging proxy. */
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
   * Disconnects, but lets anything already sent reach the desktop app first. Prefer this wherever
   * the caller can still await; {@link disconnect} is the synchronous last resort.
   */
  async drainAndDisconnect(): Promise<void> {
    this.desktopVerification = undefined;
    await this.transport?.drain();
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
      if (lt(response.version, MINIMUM_BIOMETRIC_DESKTOP_VERSION)) {
        throw new Error(`Bitwarden Desktop ${response.version} is unsupported.`);
      }
      return response.version;
    } catch (error) {
      const reason = this.explainDiscoverFailure(error);
      this.disconnect();
      throw new Error(reason);
    }
  }

  /**
   * Names the failure a discover timeout actually represents.
   *
   * A proxy that reported `connected` reached *an* IPC socket, so the desktop app on the other end
   * either predates SDK IPC or is a different instance than intended. The latter is the standard
   * debug-run mistake: `debug:cli` points the proxy at an isolated socket directory, so a CLI run
   * against a normally-launched desktop app talks to a proxy that connected to nothing the app is
   * listening on. Blaming the desktop version there sends the reader looking in the wrong place.
   */
  private explainDiscoverFailure(error: unknown): string {
    const details = error instanceof Error ? ` ${error.message}` : "";
    const { connected, proxyPath } = this.transport?.proxyConnection ?? { connected: false };

    if (connected) {
      const socketDir = process.env[IPC_SOCKET_DIR_ENV];
      const where =
        socketDir != null && socketDir !== ""
          ? `${IPC_SOCKET_DIR_ENV} is ${socketDir}, so the desktop app must be running against that directory too`
          : `${IPC_SOCKET_DIR_ENV} is unset, so a desktop app started with it set is not reachable from here`;

      return `The Bitwarden Desktop proxy at ${proxyPath} connected, but no desktop app answered. Either it predates SDK IPC (${MINIMUM_BIOMETRIC_DESKTOP_VERSION} or newer is required) or it is a different instance: ${where}.${details}`;
    }

    return `Could not establish SDK IPC with Bitwarden Desktop. Biometric unlock requires Bitwarden Desktop ${MINIMUM_BIOMETRIC_DESKTOP_VERSION} or newer.${details}`;
  }

  private async initialize(): Promise<void> {
    await SdkLoadService.Ready;

    const receive = (message: IncomingMessage) => this.communicationBackend?.receive(message);
    this.transport = new CliDesktopIpcTransport(
      this.logService,
      receive,
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
