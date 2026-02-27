export const AUTOTYPE_IPC_CHANNELS = {
  INIT: "autofill.initAutotype",
  INITIALIZED: "autofill.autotypeIsInitialized",
  TOGGLE: "autofill.toggleAutotype",
  CONFIGURE: "autofill.configureAutotype",
  LISTEN: "autofill.listenAutotypeRequest",
  EXECUTION_ERROR: "autofill.autotypeExecutionError",
  EXECUTE: "autofill.executeAutotype",
} as const;
