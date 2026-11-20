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
  ACTIVITY: "sshagent.activity",
  ACTIVITY_LOG: "sshagent.activitylog",
} as const;

/** Channels for `ipc.autofill.sshAgent.setup`. Arguments are limited to a planId and step ids. */
export const SSH_AGENT_SETUP_IPC_CHANNELS = Object.freeze({
  GET_ENVIRONMENT: "sshagent.setup.getEnvironment",
  GET_STATUS: "sshagent.setup.getStatus",
  GET_PLAN: "sshagent.setup.getPlan",
  APPLY: "sshagent.setup.apply",
  UNDO: "sshagent.setup.undo",
  VERIFY: "sshagent.setup.verify",
} as const);
