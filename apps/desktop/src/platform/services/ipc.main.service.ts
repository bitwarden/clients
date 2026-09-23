import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import {
  ForwardedIpcMessage,
  IpcMessage,
  DesktopIpcPeerClientType,
  IpcService,
  isIpcMessage,
} from "@bitwarden/common/platform/ipc";
import { ipc } from "@bitwarden/desktop-napi";
import {
  IncomingMessage,
  IpcClient,
  IpcCommunicationBackend,
  ipcRegisterDiscoverHandler,
  OutgoingMessage,
  Source,
} from "@bitwarden/sdk-internal";

import { NativeMessagingMain } from "../../main/native-messaging.main";
import { WindowMain } from "../../main/window.main";

export class IpcMainService extends IpcService {
  private communicationBackend?: IpcCommunicationBackend;

  constructor(
    private logService: LogService,
    private app: Electron.App,
    private nativeMessaging: NativeMessagingMain,
    private windowMain: WindowMain,
  ) {
    super();
  }

  override async init() {
    try {
      // This function uses classes and functions defined in the SDK, so we need to wait for the SDK to load.
      await SdkLoadService.Ready;

      this.communicationBackend = new IpcCommunicationBackend({
        send: async (message: OutgoingMessage): Promise<void> => {
          if (message.destination === "DesktopMain") {
            throw new Error(
              `Destination not supported: ${JSON.stringify(message.destination)} (cannot send messages to self)`,
            );
          }

          const nativeHost = nativeMessagingHost(message.destination);
          if (nativeHost != null) {
            const ipcMessage = {
              type: "bitwarden-ipc-message",
              message: {
                destination: message.destination,
                payload: [...message.payload],
                topic: message.topic,
              },
            } satisfies IpcMessage;

            this.nativeMessaging.sendTo(extractClientId(nativeHost), ipcMessage);
            return;
          }

          if (message.destination === "DesktopRenderer") {
            this.windowMain.win?.webContents.send("ipc.onMessage", {
              type: "bitwarden-ipc-message",
              message: {
                destination: message.destination,
                payload: [...message.payload],
                topic: message.topic,
              },
            } satisfies IpcMessage);
            return;
          }
        },
      });

      this.nativeMessaging.messages$.subscribe((nativeMessage: ipc.IpcMessage) => {
        if (!nativeMessage.message) {
          return;
        }

        let ipcMessage: unknown;
        try {
          ipcMessage = JSON.parse(nativeMessage.message);
        } catch (e) {
          // A malformed native message must not tear down the subscription, which would
          // break IPC for all subsequent messages.
          this.logService.error("[IPC] Failed to parse native message", e);
          return;
        }

        if (!isIpcMessage(ipcMessage)) {
          return;
        }

        try {
          // Forward to renderer process
          if (ipcMessage.message.destination === "DesktopRenderer") {
            this.windowMain.win?.webContents.send("ipc.onMessage", {
              type: "forwarded-bitwarden-ipc-message",
              message: ipcMessage.message,
              originalSource: this.sourceFor(nativeMessage.clientId),
            } satisfies ForwardedIpcMessage);
            return;
          }

          if (ipcMessage.message.destination !== "DesktopMain") {
            return;
          }

          this.communicationBackend?.receive(
            new IncomingMessage(
              new Uint8Array(ipcMessage.message.payload),
              ipcMessage.message.destination,
              this.sourceFor(nativeMessage.clientId),
              ipcMessage.message.topic,
            ),
          );
        } catch (e) {
          // A throw here (e.g. backend.receive or webContents.send) must not tear down
          // the subscription, which would break IPC for all subsequent messages.
          this.logService.error("[IPC] Failed to process native message", e);
        }
      });

      // Handle messages from renderer process
      ipcMain.on("ipc.send", async (_event, message: IpcMessage) => {
        try {
          if (message.message.destination === "DesktopMain") {
            this.communicationBackend?.receive(
              new IncomingMessage(
                new Uint8Array(message.message.payload),
                message.message.destination,
                "DesktopRenderer" as Source,
                message.message.topic,
              ),
            );
            return;
          }

          // Forward to native messaging
          const nativeHost = nativeMessagingHost(message.message.destination);
          if (nativeHost != null) {
            const forwardedMessage = {
              type: "forwarded-bitwarden-ipc-message",
              message: {
                destination: message.message.destination,
                payload: [...message.message.payload],
                topic: message.message.topic,
              },
              originalSource: "DesktopRenderer" as Source,
            } satisfies ForwardedIpcMessage;

            this.nativeMessaging.sendTo(extractClientId(nativeHost), forwardedMessage);
          }
        } catch (e) {
          // The listener is async and ipcMain.on does not await it, so a throw here
          // (e.g. extractClientId on an unresolvable host, or sendTo on a disconnected
          // client) would surface as an unhandled promise rejection.
          this.logService.error("[IPC] Failed to handle renderer message", e);
        }
      });

      await super.initWithClient(IpcClient.newWithSdkInMemorySessions(this.communicationBackend));

      await ipcRegisterDiscoverHandler(this.client, {
        version: this.app.getVersion(),
      });
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }

  /**
   * The source a native-messaging client's messages arrive from.
   *
   * Every client reaches the desktop app through an identically spawned `desktop_proxy`, so the
   * socket alone does not say which one it is. A client that announced itself gets its own
   * endpoint; one that did not is a browser background page, the only client that predates the
   * announcement.
   */
  private sourceFor(clientId: number): Source {
    if (this.nativeMessaging.clientTypeFor(clientId) === DesktopIpcPeerClientType.Cli) {
      return cliSource(clientId);
    }

    return { BrowserBackground: { id: { Id: clientId } } } as Source;
  }
}

type NativeMessagingHost = { id: string | { Id: number } };

/**
 * Addresses the CLI as its own endpoint.
 * Note: Merge only after cli changes merged!!!
 */
function cliSource(clientId: number): Source {
  return { Cli: { id: { Id: clientId } } } as unknown as Source;
}

/**
 * The host of a destination reached over native messaging, or `undefined` for one that is not.
 */
function nativeMessagingHost(
  destination: OutgoingMessage["destination"],
): NativeMessagingHost | undefined {
  if (typeof destination !== "object") {
    return undefined;
  }

  if ("BrowserBackground" in destination) {
    return destination.BrowserBackground;
  }

  if ("Cli" in destination) {
    return (destination as { Cli: NativeMessagingHost }).Cli;
  }

  return undefined;
}

/**
 * Extract a numeric client ID from a native-messaging host ID.
 * Throws if the id is `"Own"`, which is not valid from the desktop's perspective.
 */
function extractClientId(host: NativeMessagingHost): number {
  if (typeof host.id === "object" && "Id" in host.id) {
    return host.id.Id;
  }
  throw new Error(`Cannot resolve native messaging host ID: ${JSON.stringify(host.id)}`);
}
