import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import {
  ForwardedIpcMessage,
  IpcMessage,
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
import { isDev } from "../../utils";

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

          if (
            typeof message.destination === "object" &&
            "BrowserBackground" in message.destination
          ) {
            const ipcMessage = {
              type: "bitwarden-ipc-message",
              message: {
                destination: message.destination,
                payload: [...message.payload],
                topic: message.topic,
              },
            } satisfies IpcMessage;

            const clientId = extractClientId(message.destination.BrowserBackground);
            if (clientId != null) {
              this.nativeMessaging.sendTo(clientId, ipcMessage);
            } else {
              this.nativeMessaging.send(ipcMessage);
            }
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

        const ipcMessage = JSON.parse(nativeMessage.message);
        if (!isIpcMessage(ipcMessage)) {
          return;
        }

        // Forward to renderer process
        if (ipcMessage.message.destination === "DesktopRenderer") {
          this.windowMain.win?.webContents.send("ipc.onMessage", {
            type: "forwarded-bitwarden-ipc-message",
            message: ipcMessage.message,
            originalSource: { BrowserBackground: { id: { Id: nativeMessage.clientId } } } as Source,
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
            { BrowserBackground: { id: { Id: nativeMessage.clientId } } } as Source,
            ipcMessage.message.topic,
          ),
        );
      });

      // Handle messages from renderer process
      ipcMain.on("ipc.send", async (_event, message: IpcMessage) => {
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
        if (
          typeof message.message.destination === "object" &&
          "BrowserBackground" in message.message.destination
        ) {
          const forwardedMessage = {
            type: "forwarded-bitwarden-ipc-message",
            message: {
              destination: message.message.destination,
              payload: [...message.message.payload],
              topic: message.message.topic,
            },
            originalSource: "DesktopRenderer" as Source,
          } satisfies ForwardedIpcMessage;

          const clientId = extractClientId(message.message.destination.BrowserBackground);
          if (clientId != null) {
            this.nativeMessaging.sendTo(clientId, forwardedMessage);
          } else {
            this.nativeMessaging.send(forwardedMessage);
          }
        }
      });

      await super.initWithClient(IpcClient.newWithSdkInMemorySessions(this.communicationBackend));

      if (isDev()) {
        await ipcRegisterDiscoverHandler(this.client, {
          version: await this.app.getVersion(),
        });
      }
    } catch (e) {
      this.logService.error("[IPC] Initialization failed", e);
    }
  }
}

/**
 * Extract a numeric client ID from a BrowserBackground host ID.
 * Returns the number if the id is `{ Id: number }`, or null if it's `"Own"`.
 */
function extractClientId(host: { id: string | { Id: number } }): number | null {
  if (typeof host.id === "object" && "Id" in host.id) {
    return host.id.Id;
  }
  return null;
}
