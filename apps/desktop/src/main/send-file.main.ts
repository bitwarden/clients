import { ipcMain } from "electron";

import { send_file } from "@bitwarden/desktop-napi";

export class SendFileMain {
  constructor() {
    ipcMain.handle("sendFile.getPathInfo", (_, path: string) => send_file.getPathInfo(path));

    ipcMain.handle("sendFile.readFile", (_, path: string) => send_file.readFile(path));

    ipcMain.handle("sendFile.readDirectory", (_, path: string) => send_file.readDirectory(path));
  }
}
