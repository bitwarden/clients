/**
 * IPC channels used to delegate renderer-only DuckDuckGo work (the verification dialog and command
 * execution) from the main-process handler back to the renderer. Kept dependency-free so both the
 * main handler and the renderer shim can import it without pulling in process-specific modules.
 */
export const DDG_IPC_CHANNELS = {
  VERIFY_REQUEST: "duckduckgo.verifyrequest",
  VERIFY_RESPONSE: "duckduckgo.verifyresponse",
  COMMAND_REQUEST: "duckduckgo.commandrequest",
  COMMAND_RESPONSE: "duckduckgo.commandresponse",
} as const;
