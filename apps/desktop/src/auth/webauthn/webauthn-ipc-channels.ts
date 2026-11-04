export const WEBAUTHN_IPC_CHANNELS = {
  GET_ASSERTION: "webauthn.getAssertion",
  CANCEL: "webauthn.cancel",
  /** Sent to the renderer when a request continues in the user's browser, on Linux. */
  BROWSER_SESSION_STARTED: "webauthn.browserSessionStarted",
  REOPEN_BROWSER: "webauthn.reopenBrowser",
} as const;
