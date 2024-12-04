import { ipcMain } from "electron";

import { fido2_hid_client } from "@bitwarden/desktop-napi";

export class WebauthnListener {
  constructor() {}

  init() {
    ipcMain.handle("webauthn.authenticate", async (event: any, message: any) => {
      return fido2_hid_client.authenticate(
        message.challenge,
        message.credentials,
        message.origin,
        "",
      );
    });
  }
}
