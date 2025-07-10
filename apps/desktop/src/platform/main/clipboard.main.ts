import { app, ipcMain } from "electron";

import { clipboards } from "@bitwarden/desktop-napi";

import { ClipboardWriteMessage } from "../types/clipboard";

export class ClipboardMain {
  lastSavedValue: string | null = null;

  init() {
    app.on("before-quit", async () => {
      if (this.lastSavedValue == null) {
        return;
      }

      const clipboardNow = await clipboards.read();
      if (clipboardNow == this.lastSavedValue) {
        await clipboards.write("", false);
      }
    });

    ipcMain.handle("clipboard.read", async (_event: any, _message: any) => {
      return await clipboards.read();
    });

    ipcMain.handle("clipboard.write", async (_event: any, message: ClipboardWriteMessage) => {
      this.lastSavedValue = message.text;
      return await clipboards.write(message.text, message.password ?? false);
    });
  }
}
