export const AUTOTYPE_IPC_CHANNELS = {
  INIT: "autofill.initAutotype",
  INITIALIZED: "autofill.autotypeIsInitialized",
  TOGGLE: "autofill.toggleAutotype",
  CONFIGURE: "autofill.configureAutotype",
  LISTEN: "autofill.listenAutotypeRequest",
  EXECUTION_ERROR: "autofill.autotypeExecutionError",
  EXECUTE: "autofill.executeAutotype",
} as const;

export const MAGNIFY_IPC_CHANNELS = {
  TOGGLE: "autofill.toggleMagnify",
  // Magnify render process -> Main process
  MAGNIFY_COMMAND: "autofill.magnifyCommand",
  // Main process -> BW render process
  MAGNIFY_COMMAND_RELAY: "autofill.magnifyCommandRelay",
  // BW render process -> Main process (for errors)
  MAGNIFY_COMMAND_RELAY_ERROR: "autofill.magnifyCommandRelayError",
  // BW render process -> Main process
  MAGNIFY_COMMAND_RESPONSE: "autofill.magnifyCommandResponse",
} as const;
