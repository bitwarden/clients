import { ipcRenderer } from "electron";

import { PublicKeyCredential } from "@bitwarden/common/auth/abstractions/webauthn/navigator-credentials.service";
import { navigator_credentials } from "@bitwarden/desktop-napi";

export default {
  loginRequest: (alertTitle: string, alertBody: string, buttonText: string): Promise<void> =>
    ipcRenderer.invoke("loginRequest", {
      alertTitle,
      alertBody,
      buttonText,
    }),
  navigatorCredentialsGet: (
    options: navigator_credentials.PublicKeyCredentialRequestOptions,
  ): Promise<PublicKeyCredential | null> => ipcRenderer.invoke("navigatorCredentials.get", options),
  navigatorCredentialsAvailable: (): Promise<boolean> =>
    ipcRenderer.invoke("navigatorCredentials.available"),
};
