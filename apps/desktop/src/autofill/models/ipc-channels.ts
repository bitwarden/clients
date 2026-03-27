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
  MAIN_PROCESS_COMMANDS_FROM_MAGNIFY_LISTENER: "autofill.mainProcessCommandsFromMagnifyListener",
  MAIN_PROCESS_COMMANDS_FROM_BW_LISTENER: "autofill.mainProcessCommandsFromBwListener",
  BW_RENDER_PROCESS_COMMANDS_FROM_MAIN_PROCESS_LISTENER:
    "autofill.bwRenderProcessCommandsFromMainProcessListener",
  //BW_RENDER_PROCESS_COMMAND_RESPONDER: "autofill.bwRenderProcessCommandResponder",
} as const;
