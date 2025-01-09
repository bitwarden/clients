import { ipcMain } from "electron";

import { clipboards } from "@bitwarden/desktop-napi";

import { ClipboardWriteMessage } from "../types/clipboard";

export class ClipboardMain {
  init() {
    ipcMain.handle("clipboard.read", async (_event: any, _message: any) => {
      return await clipboards.read();
    });

    ipcMain.handle("clipboard.write", async (_event: any, message: ClipboardWriteMessage) => {
      return await clipboards.write(message.text, message.password ?? false);
    });
  }
}
