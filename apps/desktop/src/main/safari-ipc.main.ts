import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ipc } from "@bitwarden/desktop-napi";

import { WindowMain } from "./window.main";

/**
 * Endpoint name for the buffered Safari IPC socket. Must match the Safari extension's
 * `BufferedSocketClient.socketName` (`s.bw-safari`) and the Rust `app_group_path` naming.
 */
const SAFARI_IPC_SOCKET_NAME = "bw-safari";

/**
 * Bridges the buffered Safari IPC socket to the renderer.
 *
 * Safari's native component is a stateless, per-request handler that the desktop cannot push to, so
 * the Rust {@link ipc.NativeBufferedIpcServer} buffers desktop → extension messages and the
 * extension drains them by polling. This class forwards extension → desktop messages to the
 * renderer and lets the renderer enqueue desktop → extension messages.
 *
 * Payloads are opaque, end-to-end encrypted by the SDK IPC layer; they are never inspected here.
 */
export class SafariIpcMain {
  private ipcServer: ipc.NativeBufferedIpcServer | null = null;

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
  ) {
    ipcMain.on("safariIpc.enqueue", (_event, message: string) => {
      this.ipcServer?.enqueue(message);
    });
  }

  async listen() {
    if (this.ipcServer) {
      this.ipcServer.stop();
    }

    this.ipcServer = await ipc.NativeBufferedIpcServer.listen(
      SAFARI_IPC_SOCKET_NAME,
      (error, message) => {
        if (error != null) {
          this.logService.warning("Safari IPC error:", error);
          return;
        }
        this.windowMain.win?.webContents.send("safariIpc.message", message);
      },
    );

    for (const socketPath of this.ipcServer.getPaths()) {
      this.logService.info("Safari IPC server started at:", socketPath);
    }
  }

  stop() {
    this.ipcServer?.stop();
    this.ipcServer = null;
  }
}
