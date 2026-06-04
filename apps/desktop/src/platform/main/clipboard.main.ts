import { app, clipboard, ipcMain } from "electron";

import { clipboards } from "@bitwarden/desktop-napi";

import { isGnome } from "../../utils";
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
      if (isGnome()) {
        // The native clipboard does not support GNOME. Use the Electron clipboard instead.
        return clipboard.readText("clipboard");
      }
      return await clipboards.read();
    });

    ipcMain.handle("clipboard.write", async (_event: any, message: ClipboardWriteMessage) => {
      this.lastSavedValue = message.text;
      if (isGnome()) {
        // The native clipboard does not support GNOME. We try both.
        clipboard.writeText(message.text, "clipboard");
      }
      return await clipboards.write(message.text, message.password ?? false);
    });
  }
}
