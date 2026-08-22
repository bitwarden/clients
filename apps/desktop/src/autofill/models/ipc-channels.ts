// MVP, delete with PM-41067
export const AUTOTYPE_MVP_IPC_CHANNELS = {
  TOGGLE: "autofill.toggleAutotypeMvp",
  CONFIGURE: "autofill.configureAutotypeMvp",
  LISTEN: "autofill.listenAutotypeRequestMvp",
  EXECUTION_ERROR: "autofill.autotypeExecutionErrorMvp",
  EXECUTE: "autofill.executeAutotypeMvp",
} as const;

export const SSH_AGENT_IPC_CHANNELS = {
  INIT: "sshagent.init",
  IS_LOADED: "sshagent.isloaded",
  STOP: "sshagent.stop",
  REPLACE: "sshagent.replace",
  SIGN_REQUEST: "sshagent.signrequest",
  SIGN_REQUEST_RESPONSE: "sshagent.signrequestresponse",
  LIST_KEYS_REQUEST: "sshagent.listkeysrequest",
  LIST_KEYS_RESPONSE: "sshagent.listkeysresponse",
} as const;
