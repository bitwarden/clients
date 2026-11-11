import { ipcRenderer } from "electron";

import type { webauthn } from "@bitwarden/desktop-napi";

import {
  AUTOMATION_WEBAUTHN_CHANNEL,
  AUTOMATION_WEBAUTHN_REQUEST_CHANNEL,
  AutomationWebAuthnAction,
  AutomationWebAuthnError,
  AutomationWebAuthnMessage,
  AutomationWebAuthnRequest,
  AutomationWebAuthnResponse,
} from "./webauthn/automation-webauthn-message";
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
  // Automation-only surface, controlled by the renderer automation driver (dev mode only).
  automation: {
    webauthn: {
      listPending: (): Promise<AutomationWebAuthnRequest[]> =>
        ipcRenderer.invoke(AUTOMATION_WEBAUTHN_CHANNEL, {
          action: AutomationWebAuthnAction.ListPending,
        } satisfies AutomationWebAuthnMessage),
      respond: (id: string, response: AutomationWebAuthnResponse): Promise<boolean> =>
        ipcRenderer.invoke(AUTOMATION_WEBAUTHN_CHANNEL, {
          action: AutomationWebAuthnAction.Respond,
          id,
          response,
        } satisfies AutomationWebAuthnMessage),
      reject: (id: string, error: AutomationWebAuthnError): Promise<boolean> =>
        ipcRenderer.invoke(AUTOMATION_WEBAUTHN_CHANNEL, {
          action: AutomationWebAuthnAction.Reject,
          id,
          error,
        } satisfies AutomationWebAuthnMessage),
      onRequest: (callback: (request: AutomationWebAuthnRequest) => void) => {
        ipcRenderer.on(AUTOMATION_WEBAUTHN_REQUEST_CHANNEL, (_event, request) => callback(request));
      },
    },
  },
};
