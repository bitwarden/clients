import { ipcRenderer } from "electron";

import type { webauthn } from "@bitwarden/desktop-napi";

import { WEBAUTHN_IPC_CHANNELS } from "./webauthn/webauthn-ipc-channels";

export default {
  loginRequest: (alertTitle: string, alertBody: string, buttonText: string): Promise<void> =>
    ipcRenderer.invoke("loginRequest", {
      alertTitle,
      alertBody,
      buttonText,
    }),
  webauthn: {
    getAssertion: (request: webauthn.AssertionRequest): Promise<webauthn.GetAssertionResult> =>
      ipcRenderer.invoke(WEBAUTHN_IPC_CHANNELS.GET_ASSERTION, request),
  },
};
