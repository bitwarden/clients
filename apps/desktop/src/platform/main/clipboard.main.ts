import { app, ipcMain } from "electron";

import { clipboards } from "@bitwarden/desktop-napi";

import { ClipboardWriteMessage } from "../types/clipboard";

export class ClipboardMain {
  lastSavedValue: string | null = null;

  init() {
    app.on("before-quit", async () => {
      await this.clearIfUnchanged();
    });

    ipcMain.handle("clipboard.read", async (_event: any, _message: any) => {
      return await clipboards.read();
    });

    ipcMain.handle("clipboard.write", async (_event: any, message: ClipboardWriteMessage) => {
      this.lastSavedValue = message.text;
      return await clipboards.write(message.text, message.password ?? false);
    });
  }

  /**
   * Clears the clipboard if it still holds the last value Bitwarden wrote. The renderer owns the
   * delayed clear, so this runs whenever the renderer goes away: on quit, and on teardown.
   */
  async clearIfUnchanged(): Promise<void> {
    if (this.lastSavedValue == null) {
      return;
    }

    const clipboardNow = await clipboards.read();
    if (clipboardNow == this.lastSavedValue) {
      await clipboards.write("", false);
    }
  }
}
