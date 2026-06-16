import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ipc } from "@bitwarden/desktop-napi";

/**
 * Ipc service for communicating with the safari extension. This is implemented in `desktop_native`.
 */
export class SafariIpcMain {
  private ipcServer: ipc.SafariIpcServer | null = null;
  private messageHandler?: (message: string) => void;

  constructor(private logService: LogService) {}

  /** Buffer a desktop -> safari extension message for delivery on the extension's next poll. */
  enqueue(message: string) {
    this.ipcServer?.enqueue(message);
  }

  /** Sets a handler to process incoming messages */
  setMessageHandler(handler: (message: string) => void) {
    this.messageHandler = handler;
  }

  async listen() {
    if (this.ipcServer) {
      this.ipcServer.stop();
    }

    this.ipcServer = await ipc.SafariIpcServer.listen((error, message) => {
      if (error != null) {
        this.logService.warning("[SafariIPC] error:", error);
        return;
      }
      this.messageHandler?.(message);
    });
  }

  stop() {
    this.ipcServer?.stop();
    this.ipcServer = null;
  }
}
