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
import { NativeMessagingHost, nativeMessagingHost } from "../utils/native-messaging-host";

export class IpcMainService extends IpcService {
  private communicationBackend?: IpcCommunicationBackend;
  /** The desktop endpoint each connected native-messaging client addresses, by client ID. */
  private readonly desktopEndpointByClient = new Map<number, DesktopEndpoint>();

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
          this.logService.info(
            `[IPC] send ${describeMessage(message)} -> nativeHost=${JSON.stringify(nativeHost)}`,
          );

          if (nativeHost != null) {
            const clientId = extractClientId(nativeHost);
            this.logService.info(
              `[IPC] Relaying to native client ${clientId}: ${describeMessage(message)}`,
            );

            // A native-messaging client keys its Noise session by the desktop endpoint it
            // addressed, so a reply has to be attributed to that same endpoint. Main answers in
            // place of the renderer, whose endpoint the clients use today, so a plain reply would
            // reach them attributed to `DesktopMain` and be dropped. Send it as the renderer's
            // forwarded message instead, under the name the client itself addressed.
            const forwardedMessage = {
              type: "forwarded-bitwarden-ipc-message",
              message: {
                destination: message.destination,
                payload: [...message.payload],
                topic: message.topic,
              },
              originalSource: this.desktopEndpointByClient.get(clientId) ?? "DesktopRenderer",
            } satisfies ForwardedIpcMessage;

            this.nativeMessaging.sendTo(clientId, forwardedMessage);
            return;
          }

          if (message.destination === "DesktopRenderer") {
            this.logService.info(`[IPC] Forwarding to renderer: ${describeMessage(message)}`);

            if (this.windowMain.win == null || this.windowMain.win.isDestroyed()) {
              // The renderer was torn down (headless main) and nobody recreated it, so the
              // message is dropped rather than queued. Log it: the caller sees only a timeout.
              this.logService.info(
                `[IPC] No renderer to forward to, dropping: ${describeMessage(message)}`,
              );
              return;
            }

            this.windowMain.win.webContents.send("ipc.onMessage", {
              type: "bitwarden-ipc-message",
              message: {
                destination: message.destination,
                payload: [...message.payload],
                topic: message.topic,
              },
            } satisfies IpcMessage);
            return;
          }

          throw new Error(`Destination not supported: ${JSON.stringify(message.destination)}`);
        },
      });

      this.nativeMessaging.messages$.subscribe((nativeMessage: ipc.IpcMessage) => {
        if (!nativeMessage.message) {
          this.logService.info(
            `[IPC] Ignoring empty native message from client ${nativeMessage.clientId}`,
          );
          return;
        }

        let ipcMessage: unknown;
        try {
          ipcMessage = JSON.parse(nativeMessage.message);
        } catch (e) {
          // A malformed native message must not tear down the subscription, which would
          // break IPC for all subsequent messages.
          this.logService.error(
            `[IPC] Failed to parse native message from client ${nativeMessage.clientId}`,
            e,
          );
          return;
        }

        if (!isIpcMessage(ipcMessage)) {
          this.logService.info(
            `[IPC] Ignoring malformed native message from client ${nativeMessage.clientId}`,
          );
          return;
        }

        try {
          // The browser extension still addresses desktop-bound IPC (shared unlock, discover) to
          // the renderer. The shared-unlock peer runs in the main process, so capture those
          // messages here and deliver them to the main process's own client, treating them as
          // addressed to DesktopMain. The browser will target DesktopMain directly in a later
          // change.
          const destination = ipcMessage.message.destination;
          if (destination !== "DesktopRenderer" && destination !== "DesktopMain") {
            this.logService.info(
              `[IPC] Ignoring native message addressed elsewhere from client ${nativeMessage.clientId}: ${describeMessage(ipcMessage.message)}`,
            );
            return;
          }

          // Remember which desktop endpoint this client addresses, so replies can be sent under
          // the same name and are attributed to the session it holds.
          this.desktopEndpointByClient.set(nativeMessage.clientId, destination);

          this.logService.info(
            `[IPC] Received from native client ${nativeMessage.clientId} (${destination}): ${describeMessage(ipcMessage.message)}`,
          );

          this.communicationBackend?.receive(
            new IncomingMessage(
              new Uint8Array(ipcMessage.message.payload),
              "DesktopMain",
              this.sourceFor(nativeMessage.clientId),
              ipcMessage.message.topic,
            ),
          );
        } catch (e) {
          // A throw here (e.g. backend.receive or webContents.send) must not tear down
          // the subscription, which would break IPC for all subsequent messages.
          this.logService.error(
            `[IPC] Failed to process native message from client ${nativeMessage.clientId}`,
            e,
          );
        }
      });

      // Handle messages from renderer process
      ipcMain.on("ipc.send", async (_event, message: IpcMessage) => {
        try {
          if (!isIpcMessage(message)) {
            this.logService.info("[IPC] Ignoring malformed message from renderer");
            return;
          }

          this.logService.info(`[IPC] Received from renderer: ${describeMessage(message.message)}`);

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
          this.logService.info(
            `[IPC] renderer ${describeMessage(message.message)} -> nativeHost=${JSON.stringify(nativeHost)}`,
          );

          if (nativeHost != null) {
            const clientId = extractClientId(nativeHost);
            this.logService.info(
              `[IPC] Relaying from renderer to native client ${clientId}: ${describeMessage(message.message)}`,
            );

            const forwardedMessage = {
              type: "forwarded-bitwarden-ipc-message",
              message: {
                destination: message.message.destination,
                payload: [...message.message.payload],
                topic: message.message.topic,
              },
              originalSource: "DesktopRenderer" as Source,
            } satisfies ForwardedIpcMessage;

            this.nativeMessaging.sendTo(clientId, forwardedMessage);
            return;
          }

          this.logService.info(
            `[IPC] Dropping renderer message with unsupported destination: ${describeMessage(message.message)}`,
          );
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

/**
 * Endpoints that address the desktop app itself, as opposed to another client of it.
 *
 * Clients reach the desktop under `DesktopRenderer`, the endpoint the renderer used before state
 * moved to the main process; they will address `DesktopMain` once they are updated to target it.
 */
type DesktopEndpoint = "DesktopRenderer" | "DesktopMain";

/**
 * A payload-free description of an IPC message, for logging.
 *
 * Payloads are opaque blobs that may hold vault data or key material, so only their size is
 * reported — never their contents.
 */
function describeMessage(message: {
  destination: unknown;
  topic?: string | null;
  payload: ArrayLike<number>;
}): string {
  return `topic=${message.topic} destination=${JSON.stringify(message.destination)} payload=${message.payload.length}B`;
}

/**
 * Addresses the CLI as its own endpoint.
 */
function cliSource(clientId: number): Source {
  return { Cli: { id: { Id: clientId } } };
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
