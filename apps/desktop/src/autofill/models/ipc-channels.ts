export const AUTOTYPE_IPC_CHANNELS = {
  INIT: "autofill.initAutotype",
  INITIALIZED: "autofill.autotypeIsInitialized",
  TOGGLE: "autofill.toggleAutotype",
  CONFIGURE: "autofill.configureAutotype",
  LISTEN: "autofill.listenAutotypeRequest",
  EXECUTION_ERROR: "autofill.autotypeExecutionError",
  EXECUTE: "autofill.executeAutotype",
} as const;

export const SSH_AGENT_IPC_CHANNELS = {
  INIT: "sshagent.init",
  IS_LOADED: "sshagent.isloaded",
  STOP: "sshagent.stop",
  REPLACE: "sshagent.replace",
  SIGN_REQUEST: "sshagent.signrequest",
  SIGN_REQUEST_RESPONSE: "sshagent.signrequestresponse",
} as const;
