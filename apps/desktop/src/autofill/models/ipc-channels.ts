export const AUTOTYPE_IPC_CHANNELS = {
  INIT: "autofill.initAutotype" as string,
  INITIALIZED: "autofill.autotypeIsInitialized" as string,
  TOGGLE: "autofill.toggleAutotype" as string,
  CONFIGURE: "autofill.configureAutotype" as string,
  LISTEN: "autofill.listenAutotypeRequest" as string,
  EXECUTION_ERROR: "autofill.autotypeExecutionError" as string,
  EXECUTE: "autofill.executeAutotype" as string,
} as const;
