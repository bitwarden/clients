import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import {
  ForwardedIpcMessage,
  IpcMessage,
  IpcService,
  isIpcMessage,
} from "@bitwarden/common/platform/ipc";
import {
  IncomingMessage,
  IpcClient,
  IpcCommunicationBackend,
  ipcRegisterDiscoverHandler,
  OutgoingMessage,
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
              `Destination not supported: ${message.destination} (cannot send messages to self)`,
            );
          }

          if (message.destination === "BrowserBackground") {
            this.nativeMessaging.send({
              type: "bitwarden-ipc-message",
              message: {
                destination: message.destination,
                payload: [...message.payload],
                topic: message.topic,
              },
            } satisfies IpcMessage);
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

      this.nativeMessaging.messages$.subscribe((nativeMessage) => {
        const ipcMessage = JSON.parse(nativeMessage.message);
        if (!isIpcMessage(ipcMessage)) {
          return;
        }

        // Forward to renderer process
        if (ipcMessage.message.destination === "DesktopRenderer") {
          this.windowMain.win?.webContents.send("ipc.onMessage", {
            type: "forwarded-bitwarden-ipc-message",
            message: ipcMessage.message,
            originalSource: "BrowserBackground",
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
            // TODO: Add ID to BrowserBackground
            "BrowserBackground",
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
              "DesktopRenderer",
              message.message.topic,
            ),
          );
          return;
        }

        // Forward to native messaging
        if (message.message.destination === "BrowserBackground") {
          this.nativeMessaging.send({
            type: "forwarded-bitwarden-ipc-message",
            message: {
              destination: message.message.destination,
              payload: [...message.message.payload],
              topic: message.message.topic,
            },
            originalSource: "DesktopRenderer",
          } satisfies ForwardedIpcMessage);
        }
      });

      await super.initWithClient(new IpcClient(this.communicationBackend));

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
