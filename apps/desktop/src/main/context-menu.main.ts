import { ipcMain } from "electron";

import { context_menu } from "@bitwarden/desktop-napi";

export class ContextMenuMain {
  constructor(private exePath: string) {
    ipcMain.handle("contextMenu.enable", async () => {
      await context_menu.register(this.exePath);
    });

    ipcMain.handle("contextMenu.disable", async () => {
      await context_menu.unregister();
    });
  }
}
