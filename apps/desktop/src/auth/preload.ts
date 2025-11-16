import { ipcRenderer } from "electron";

import { PublicKeyCredential } from "@bitwarden/desktop-napi";

export default {
  loginRequest: (alertTitle: string, alertBody: string, buttonText: string): Promise<void> =>
    ipcRenderer.invoke("loginRequest", {
      alertTitle,
      alertBody,
      buttonText,
    }),
  navigatorCredentialsGet: (
    options: CredentialRequestOptions,
  ): Promise<PublicKeyCredential | null> => ipcRenderer.invoke("navigatorCredentialsGet", options),
};
