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
  SET_KEYS: "sshagent.setkeys",
  SIGN_REQUEST_RESPONSE: "sshagent.signrequestresponse",
  LOCK: "sshagent.lock",
  CLEAR_KEYS: "sshagent.clearkeys",
  SIGN_REQUEST: "sshagent.signrequest",
  UNLOCK_REQUEST: "sshagent.unlockrequest",
} as const;
