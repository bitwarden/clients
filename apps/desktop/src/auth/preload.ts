import { ipcRenderer } from "electron";

import type { webauthn } from "@bitwarden/desktop-napi";

import type { WebVault } from "./webauthn/native-webauthn";
import { WEBAUTHN_IPC_CHANNELS } from "./webauthn/webauthn-ipc-channels";

export default {
  loginRequest: (alertTitle: string, alertBody: string, buttonText: string): Promise<void> =>
    ipcRenderer.invoke("loginRequest", {
      alertTitle,
      alertBody,
      buttonText,
    }),
  webauthn: {
    /** `requestId` identifies the request to {@link cancel}. */
    getAssertion: (
      requestId: string,
      request: webauthn.AssertionRequest,
      webVault: WebVault,
    ): Promise<webauthn.GetAssertionResult> =>
      ipcRenderer.invoke(WEBAUTHN_IPC_CHANNELS.GET_ASSERTION, requestId, request, webVault),
    cancel: (requestId: string): Promise<void> =>
      ipcRenderer.invoke(WEBAUTHN_IPC_CHANNELS.CANCEL, requestId),
    /** Returns a function that removes the listener. */
    onBrowserSessionStarted: (listener: (requestId: string) => void): (() => void) => {
      const handler = (_event: unknown, requestId: string) => listener(requestId);
      ipcRenderer.on(WEBAUTHN_IPC_CHANNELS.BROWSER_SESSION_STARTED, handler);
      return () =>
        ipcRenderer.removeListener(WEBAUTHN_IPC_CHANNELS.BROWSER_SESSION_STARTED, handler);
    },
    reopenBrowser: (requestId: string): Promise<void> =>
      ipcRenderer.invoke(WEBAUTHN_IPC_CHANNELS.REOPEN_BROWSER, requestId),
  },
};
