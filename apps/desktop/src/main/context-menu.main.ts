import * as path from "path";

import { ipcMain } from "electron";

import { context_menu } from "@bitwarden/desktop-napi";

export class ContextMenuMain {
  private readonly installDir: string;
  private readonly msixPath: string;

  constructor(private exePath: string) {
    this.installDir = path.dirname(exePath);
    this.msixPath = path.join(this.installDir, "bitwarden-sparse.msix");

    ipcMain.handle("contextMenu.enable", () => {
      context_menu.register(this.exePath, this.msixPath, this.installDir);
    });

    ipcMain.handle("contextMenu.disable", () => {
      context_menu.unregister();
    });
  }
}
