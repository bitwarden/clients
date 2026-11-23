/** The main-to-renderer round trip for the DuckDuckGo connection's verify dialog. */
export const DDG_IPC_CHANNELS = {
  VERIFY_REQUEST: "ddg.verifyrequest",
  VERIFY_REQUEST_RESPONSE: "ddg.verifyrequestresponse",
} as const;
