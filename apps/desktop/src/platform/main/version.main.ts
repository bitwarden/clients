import { ipcMain } from "electron";

import { WindowMain } from "../../main/window.main";

export class VersionMain {
  constructor(private windowMain: WindowMain) {}

  sdkVersion() {
    const timeout = new Promise((resolve) => setTimeout(() => resolve("Timeout error"), 1000));
    const version = new Promise((resolve) => {
      ipcMain.once("sdkVersion", (_, version) => resolve(version));
      this.windowMain.win.webContents.send("sdkVersion");
    });

    return Promise.race([timeout, version]);
  }
}
