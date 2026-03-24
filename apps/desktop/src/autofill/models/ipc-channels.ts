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
  //INIT: "autofill.initMagnify",
  //INITIALIZED: "autofill.magnifyIsInitialized",
  TOGGLE: "autofill.toggleMagnify",
  //CONFIGURE: "autofill.configureMagnify",
  //LISTEN: "autofill.listenMagnifyRequest",
  //EXECUTION_ERROR: "autofill.magnifyExecutionError",
  //OPEN: "autofill.openMagnify",
} as const;
