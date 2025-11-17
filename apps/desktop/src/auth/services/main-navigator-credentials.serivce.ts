import { ipcMain } from "electron";

import { navigator_credentials } from "@bitwarden/desktop-napi";

export class MainNavigatorCredentialsService {
  constructor() {
    ipcMain.handle(
      "navigatorCredentials.get",
      async (_event: any, message: navigator_credentials.PublicKeyCredentialRequestOptions) => {
        return navigator_credentials.get(message);
      },
    );
    ipcMain.handle("navigatorCredentials.available", async (_event: any, _message: any) => {
      return navigator_credentials.available();
    });
  }
}
