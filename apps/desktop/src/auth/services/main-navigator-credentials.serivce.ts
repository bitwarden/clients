import { ipcMain } from "electron";

import { navigator_credentials } from "@bitwarden/desktop-napi";

export class MainNavigatorCredentialsService {
  constructor() {
    ipcMain.handle(
      "navigatorCredentials.get",
      async (_event: any, message: navigator_credentials.PublicKeyCredentialRequestOptions) => {
        const result = navigator_credentials.get(message);
        return {
          authenticatorAttachment: result.authenticatorAttachment,
          id: result.id,
          rawId: result.rawId,
          response: {
            clientDataJSON: result.response.clientDataJson,
            authenticatorData: result.response.authenticatorData,
            signature: result.response.signature,
            userHandle: result.response.userHandle,
          },
          type: result.type,
          prf: result.prf,
        };
      },
    );
    ipcMain.handle("navigatorCredentials.available", async (_event: any, _message: any) => {
      return navigator_credentials.available();
    });
  }
}
