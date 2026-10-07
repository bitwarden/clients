export const AGENT_ACCESS_IPC_CHANNELS = {
  INIT: "agentaccess.init",
  IS_LOADED: "agentaccess.isloaded",
  STOP: "agentaccess.stop",
  GET_FINGERPRINT: "agentaccess.getfingerprint",
  GENERATE_PSK_TOKEN: "agentaccess.generatepsktoken",
  GENERATE_RENDEZVOUS_CODE: "agentaccess.generaterendezvouscode",
  LIST_CONNECTIONS: "agentaccess.listconnections",
  REMOVE_CONNECTION: "agentaccess.removeconnection",
  // renderer -> main (ipcMain.handle)
  GET_ACTIVITY: "agentaccess.getactivity",
  // Drops the whole buffer on logout/account switch, so one account's session activity is never
  // readable by the next. renderer -> main (ipcMain.handle)
  CLEAR_ACTIVITY: "agentaccess.clearactivity",
  // One activity entry, newly opened or resolved in place; the renderer upserts it by `id`.
  // main -> renderer (MessagingService)
  ACTIVITY: "agentaccess.activity",
  // The buffer was cleared wholesale, so the renderer must re-fetch rather than reconcile.
  // main -> renderer (MessagingService)
  ACTIVITY_RESET: "agentaccess.activityreset",
  // main -> renderer (MessagingService)
  CREDENTIAL_REQUEST: "agentaccess.credentialrequest",
  // renderer -> main (ipcMain.handle)
  CREDENTIAL_REQUEST_RESPONSE: "agentaccess.credentialrequestresponse",
  // main -> renderer (MessagingService)
  FINGERPRINT_REQUEST: "agentaccess.fingerprintrequest",
  // renderer -> main (ipcMain.handle)
  FINGERPRINT_RESPONSE: "agentaccess.fingerprintresponse",
  // renderer -> main (ipcMain.handle)
  GET_BUNDLED_CLI_PATH: "agentaccess.getbundledclipath",
  // Multi-agent support (M3, agent-access-architecture.md) — detects which supported agent clients
  // (models/agent-registry.ts) are installed, and registers the bundled `aac mcp` server with a
  // given one. renderer -> main (ipcMain.handle)
  DETECT_AGENTS: "agentaccess.detectagents",
  REGISTER_WITH_AGENT: "agentaccess.registerwithagent",
  // Read-only per-agent registration status (used for the UI's persistent "Connected" state) —
  // never writes, see AgentAccessRegistrationStatusService. renderer -> main (ipcMain.handle)
  GET_AGENT_REGISTRATION_STATUSES: "agentaccess.getagentregistrationstatuses",
  // First-use authorization grant store (W2b) — available independent of INIT/run state, like
  // GET_ACTIVITY. renderer -> main (ipcMain.handle)
  LIST_GRANTS: "agentaccess.listgrants",
  UPSERT_GRANT: "agentaccess.upsertgrant",
  REMOVE_GRANT: "agentaccess.removegrant",
  FIND_GRANT: "agentaccess.findgrant",
  // The grant store was written to, so any open Agent Access page must re-read it. Unlike the
  // channels above this is not an IPC handle at all: the writer
  // (`DesktopAgentAccessService.authorizeLocalRequest`) and the reader
  // (`AgentAccessAgentsComponent`) both live in the renderer, and the write happens outside the
  // page's own lifecycle — a credential request can arrive while the page is already open, whose
  // per-route `AgentAccessPageStateService` has already fetched. renderer -> renderer
  // (MessageSender/MessageListener)
  GRANTS_CHANGED: "agentaccess.grantschanged",
  // Optional OpenShell integration (agent-access-architecture.md, §M8.8). Detection never runs a
  // process or opens a connection; the snippet is text only and is the fallback for the setup
  // channels below. renderer -> main (ipcMain.handle)
  DETECT_OPENSHELL: "agentaccess.detectopenshell",
  GET_OPENSHELL_SNIPPET: "agentaccess.getopenshellsnippet",
  // Starts/stops the toggle-gated OpenShell socket. Main re-runs detection itself and computes
  // the socket path; the renderer only says on/off. renderer -> main (ipcMain.handle)
  SET_OPENSHELL_LISTENER: "agentaccess.setopenshelllistener",
  GET_OPENSHELL_DRIVER_LAST_SEEN: "agentaccess.getopenshelldriverlastseen",
  // One-button setup (§M8.19): edits gateway.toml and restarts the gateway. Takes no arguments —
  // every path and command is chosen in main.
  GET_OPENSHELL_SETUP_STATUS: "agentaccess.getopenshellsetupstatus",
  RUN_OPENSHELL_SETUP: "agentaccess.runopenshellsetup",
  REMOVE_OPENSHELL_SETUP: "agentaccess.removeopenshellsetup",
  // OpenShell management page (§M8.20). Each takes one plain request object (or none), validated
  // in main, and returns an `OpenShellManagementResult<T>`; none ever throws across IPC.
  OPENSHELL_LIST_SANDBOXES: "agentaccess.openshell.listsandboxes",
  OPENSHELL_SANDBOX_ACTION: "agentaccess.openshell.sandboxaction",
  OPENSHELL_CREATE_SANDBOX: "agentaccess.openshell.createsandbox",
  OPENSHELL_LIST_PROFILES: "agentaccess.openshell.listprofiles",
  OPENSHELL_LIST_CREDENTIALS: "agentaccess.openshell.listcredentials",
  OPENSHELL_ADD_CREDENTIAL: "agentaccess.openshell.addcredential",
  OPENSHELL_REMOVE_CREDENTIAL: "agentaccess.openshell.removecredential",
  OPENSHELL_GET_APPLY_STATUS: "agentaccess.openshell.getapplystatus",
  OPENSHELL_CREATE_PROFILE: "agentaccess.openshell.createprofile",
  OPENSHELL_UPDATE_PROFILE: "agentaccess.openshell.updateprofile",
  OPENSHELL_DELETE_PROFILE: "agentaccess.openshell.deleteprofile",
  // Environments, secret sets and sandbox metadata (§M8.20 rule 17). App-side only: no process is run.
  OPENSHELL_ENV_LIST: "agentaccess.openshell.envlist",
  OPENSHELL_ENV_SAVE: "agentaccess.openshell.envsave",
  OPENSHELL_ENV_DELETE: "agentaccess.openshell.envdelete",
  OPENSHELL_SET_LIST: "agentaccess.openshell.setlist",
  OPENSHELL_SET_SAVE: "agentaccess.openshell.setsave",
  OPENSHELL_SET_DELETE: "agentaccess.openshell.setdelete",
  OPENSHELL_META_GET: "agentaccess.openshell.metaget",
  OPENSHELL_META_SET: "agentaccess.openshell.metaset",
  // Open a shell and port forwards for one sandbox (§M8.20 rule 15). Same envelope and gate.
  OPENSHELL_LIST_FORWARDS: "agentaccess.openshell.listforwards",
  OPENSHELL_START_FORWARD: "agentaccess.openshell.startforward",
  OPENSHELL_STOP_FORWARD: "agentaccess.openshell.stopforward",
  OPENSHELL_OPEN_SHELL: "agentaccess.openshell.openshell",
  OPENSHELL_SAVED_PORTS_GET: "agentaccess.openshell.savedportsget",
  OPENSHELL_SAVED_PORTS_SET: "agentaccess.openshell.savedportsset",
  OPENSHELL_LIST_ACTIVITY: "agentaccess.openshell.listactivity",
  // Agent permission requests (§M8.20 rule 16): pending network rules the gateway recorded for
  // blocked outbound requests. Same envelope as the management channels above.
  OPENSHELL_LIST_REQUESTS: "agentaccess.openshell.listrequests",
  OPENSHELL_APPROVE_REQUEST: "agentaccess.openshell.approverequest",
  OPENSHELL_REJECT_REQUEST: "agentaccess.openshell.rejectrequest",
} as const;
