import { ipcRenderer } from "electron";

import type { agent_access } from "@bitwarden/desktop-napi";

import { AgentAccessActivityEntry, CredentialRequestOutcome } from "./models/agent-access-activity";
import {
  AgentAccessGrant,
  AgentAccessGrantKey,
  UpsertAgentAccessGrantInput,
} from "./models/agent-access-grant";
import { AgentDetectionResult } from "./models/agent-detection";
import { AgentId } from "./models/agent-id";
import { RegisterWithAgentResult } from "./models/agent-registration";
import { AgentRegistrationStatusResult } from "./models/agent-registration-status";
import { AGENT_ACCESS_IPC_CHANNELS } from "./models/ipc-channels";
import {
  OpenShellDetectionResult,
  OpenShellSetupResult,
  OpenShellSetupStatus,
  OpenShellSnippet,
  SetOpenShellListenerResult,
} from "./models/openshell";
import { OpenShellActivityEvent, OpenShellListActivityRequest } from "./models/openshell-activity";
import {
  OpenShellDeleteByIdRequest,
  OpenShellEnvironment,
  OpenShellSandboxMeta,
  OpenShellSaveEnvironmentRequest,
  OpenShellSaveSecretSetRequest,
  OpenShellSecretSet,
  OpenShellSetSandboxMetaRequest,
} from "./models/openshell-environments";
import {
  OpenShellAddCredentialRequest,
  OpenShellApplyStatus,
  OpenShellCreatedSandbox,
  OpenShellCreateSandboxRequest,
  OpenShellManagementResult,
  OpenShellProviderProfile,
  OpenShellCreateProfileRequest,
  OpenShellDeleteProfileRequest,
  OpenShellRemoveCredentialRequest,
  OpenShellUpdateProfileRequest,
  OpenShellSandbox,
  OpenShellSandboxActionRequest,
  OpenShellSandboxCredential,
} from "./models/openshell-management";
import {
  OpenShellForward,
  OpenShellGetSavedPortsRequest,
  OpenShellListForwardsRequest,
  OpenShellOpenShellRequest,
  OpenShellOpenShellResult,
  OpenShellSavedPort,
  OpenShellSetSavedPortsRequest,
  OpenShellStartForwardRequest,
  OpenShellStopForwardRequest,
} from "./models/openshell-ports";
import {
  OpenShellApproveRequestRequest,
  OpenShellListRequestsRequest,
  OpenShellRejectRequestRequest,
  OpenShellRequest,
} from "./models/openshell-requests";

const agentAccess = {
  init: async (options: { relayUrl: string }): Promise<void> => {
    await ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.INIT, options);
  },
  isLoaded(): Promise<boolean> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.IS_LOADED);
  },
  stop: async (): Promise<void> => {
    await ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.STOP);
  },
  getFingerprint(): Promise<string> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.GET_FINGERPRINT);
  },
  generatePskToken(name: string | null, reusable: boolean): Promise<string> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.GENERATE_PSK_TOKEN, { name, reusable });
  },
  generateRendezvousCode(name: string | null): Promise<string> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.GENERATE_RENDEZVOUS_CODE, { name });
  },
  listConnections(): Promise<agent_access.ConnectionInfoData[]> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.LIST_CONNECTIONS);
  },
  removeConnection(fingerprint: string): Promise<void> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.REMOVE_CONNECTION, { fingerprint });
  },
  getActivity(): Promise<AgentAccessActivityEntry[]> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.GET_ACTIVITY);
  },
  clearActivity(): Promise<void> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.CLEAR_ACTIVITY);
  },
  credentialRequestResponse: async (
    requestId: number,
    response: agent_access.CredentialResponseData,
    // Activity-log annotation for the request's row. Kept separate from `response` so the payload
    // that may carry a live credential is never the thing the activity log reads from.
    outcome?: CredentialRequestOutcome,
  ): Promise<boolean> => {
    // `true` when the answer reached a request that was still waiting (see main's
    // `settlePendingRequest`).
    const delivered: unknown = await ipcRenderer.invoke(
      AGENT_ACCESS_IPC_CHANNELS.CREDENTIAL_REQUEST_RESPONSE,
      { requestId, response, outcome },
    );
    return delivered === true;
  },
  fingerprintResponse: async (
    requestId: number,
    response: agent_access.FingerprintVerificationResponse,
  ): Promise<void> => {
    await ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.FINGERPRINT_RESPONSE, {
      requestId,
      response,
    });
  },
  getBundledCliPath(): Promise<string | null> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.GET_BUNDLED_CLI_PATH);
  },
  detectAgents(): Promise<AgentDetectionResult[]> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.DETECT_AGENTS);
  },
  registerWithAgent(agentId: AgentId): Promise<RegisterWithAgentResult> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.REGISTER_WITH_AGENT, agentId);
  },
  getAgentRegistrationStatuses(): Promise<AgentRegistrationStatusResult[]> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.GET_AGENT_REGISTRATION_STATUSES);
  },
  listGrants(): Promise<AgentAccessGrant[]> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.LIST_GRANTS);
  },
  findGrant(key: AgentAccessGrantKey): Promise<AgentAccessGrant | null> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.FIND_GRANT, key);
  },
  // `null` means the main process refused to persist the grant — either the input was malformed,
  // or the attested peer has no attestable identity at all (no valid signature and no resolvable
  // exe path), which must never collapse into a single catch-all grant. See
  // `MainAgentAccessService`'s UPSERT_GRANT handler and `AgentAccessGrantStoreService.upsert`.
  upsertGrant(input: UpsertAgentAccessGrantInput): Promise<AgentAccessGrant | null> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.UPSERT_GRANT, input);
  },
  removeGrant(id: string): Promise<void> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.REMOVE_GRANT, { id });
  },
  // Optional OpenShell integration (agent-access-architecture.md, §M8.8). None of these write a
  // file or run an OpenShell binary; the socket path is computed in main.
  detectOpenShell(): Promise<OpenShellDetectionResult> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.DETECT_OPENSHELL);
  },
  getOpenShellSnippet(): Promise<OpenShellSnippet | null> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.GET_OPENSHELL_SNIPPET);
  },
  setOpenShellListener(enabled: boolean): Promise<SetOpenShellListenerResult> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.SET_OPENSHELL_LISTENER, enabled);
  },
  getOpenShellDriverLastSeen(): Promise<number | null> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.GET_OPENSHELL_DRIVER_LAST_SEEN);
  },
  // One-button setup (§M8.19). No arguments: main picks every path and command itself.
  getOpenShellSetupStatus(): Promise<OpenShellSetupStatus> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.GET_OPENSHELL_SETUP_STATUS);
  },
  runOpenShellSetup(): Promise<OpenShellSetupResult> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.RUN_OPENSHELL_SETUP);
  },
  removeOpenShellSetup(): Promise<OpenShellSetupResult> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.REMOVE_OPENSHELL_SETUP);
  },
  // OpenShell management page (§M8.20). Each takes one plain request object, is validated in main,
  // and resolves to an `OpenShellManagementResult`; none rejects.
  listOpenShellSandboxes(): Promise<OpenShellManagementResult<OpenShellSandbox[]>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_LIST_SANDBOXES);
  },
  openShellSandboxAction(
    request: OpenShellSandboxActionRequest,
  ): Promise<OpenShellManagementResult<void>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_SANDBOX_ACTION, request);
  },
  createOpenShellSandbox(
    request: OpenShellCreateSandboxRequest,
  ): Promise<OpenShellManagementResult<OpenShellCreatedSandbox>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_CREATE_SANDBOX, request);
  },
  listOpenShellProfiles(): Promise<OpenShellManagementResult<OpenShellProviderProfile[]>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_LIST_PROFILES);
  },
  listOpenShellCredentials(request: {
    sandboxName: string;
  }): Promise<OpenShellManagementResult<OpenShellSandboxCredential[]>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_LIST_CREDENTIALS, request);
  },
  addOpenShellCredential(
    request: OpenShellAddCredentialRequest,
  ): Promise<OpenShellManagementResult<void>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_ADD_CREDENTIAL, request);
  },
  removeOpenShellCredential(
    request: OpenShellRemoveCredentialRequest,
  ): Promise<OpenShellManagementResult<void>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_REMOVE_CREDENTIAL, request);
  },
  // Open a shell and port forwards for one sandbox (§M8.20 rule 15).
  listOpenShellForwards(
    request: OpenShellListForwardsRequest,
  ): Promise<OpenShellManagementResult<OpenShellForward[]>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_LIST_FORWARDS, request);
  },
  startOpenShellForward(
    request: OpenShellStartForwardRequest,
  ): Promise<OpenShellManagementResult<void>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_START_FORWARD, request);
  },
  stopOpenShellForward(
    request: OpenShellStopForwardRequest,
  ): Promise<OpenShellManagementResult<void>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_STOP_FORWARD, request);
  },
  openOpenShellShell(
    request: OpenShellOpenShellRequest,
  ): Promise<OpenShellManagementResult<OpenShellOpenShellResult>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_OPEN_SHELL, request);
  },
  getOpenShellSavedPorts(
    request: OpenShellGetSavedPortsRequest,
  ): Promise<OpenShellManagementResult<OpenShellSavedPort[]>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_SAVED_PORTS_GET, request);
  },
  setOpenShellSavedPorts(
    request: OpenShellSetSavedPortsRequest,
  ): Promise<OpenShellManagementResult<OpenShellSavedPort[]>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_SAVED_PORTS_SET, request);
  },
  getOpenShellApplyStatus(request: {
    sandboxName: string;
  }): Promise<OpenShellManagementResult<OpenShellApplyStatus>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_GET_APPLY_STATUS, request);
  },
  createOpenShellProfile(
    request: OpenShellCreateProfileRequest,
  ): Promise<OpenShellManagementResult<void>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_CREATE_PROFILE, request);
  },
  updateOpenShellProfile(
    request: OpenShellUpdateProfileRequest,
  ): Promise<OpenShellManagementResult<void>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_UPDATE_PROFILE, request);
  },
  deleteOpenShellProfile(
    request: OpenShellDeleteProfileRequest,
  ): Promise<OpenShellManagementResult<void>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_DELETE_PROFILE, request);
  },
  // Environments, secret sets and sandbox metadata (§M8.20 rule 17): ids and names only.
  listOpenShellEnvironments(): Promise<OpenShellManagementResult<OpenShellEnvironment[]>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_ENV_LIST);
  },
  saveOpenShellEnvironment(
    request: OpenShellSaveEnvironmentRequest,
  ): Promise<OpenShellManagementResult<OpenShellEnvironment>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_ENV_SAVE, request);
  },
  deleteOpenShellEnvironment(
    request: OpenShellDeleteByIdRequest,
  ): Promise<OpenShellManagementResult<void>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_ENV_DELETE, request);
  },
  listOpenShellSecretSets(): Promise<OpenShellManagementResult<OpenShellSecretSet[]>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_SET_LIST);
  },
  saveOpenShellSecretSet(
    request: OpenShellSaveSecretSetRequest,
  ): Promise<OpenShellManagementResult<OpenShellSecretSet>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_SET_SAVE, request);
  },
  deleteOpenShellSecretSet(
    request: OpenShellDeleteByIdRequest,
  ): Promise<OpenShellManagementResult<void>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_SET_DELETE, request);
  },
  getOpenShellSandboxMeta(): Promise<OpenShellManagementResult<OpenShellSandboxMeta[]>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_META_GET);
  },
  setOpenShellSandboxMeta(
    request: OpenShellSetSandboxMetaRequest,
  ): Promise<OpenShellManagementResult<void>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_META_SET, request);
  },
  listOpenShellActivity(
    request: OpenShellListActivityRequest,
  ): Promise<OpenShellManagementResult<OpenShellActivityEvent[]>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_LIST_ACTIVITY, request);
  },
  // Agent permission requests (§M8.20 rule 16). Validated in main; approving a flagged request
  // needs `confirmFlagged: true`; there is no approve-all.
  listOpenShellRequests(
    request: OpenShellListRequestsRequest,
  ): Promise<OpenShellManagementResult<OpenShellRequest[]>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_LIST_REQUESTS, request);
  },
  approveOpenShellRequest(
    request: OpenShellApproveRequestRequest,
  ): Promise<OpenShellManagementResult<void>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_APPROVE_REQUEST, request);
  },
  rejectOpenShellRequest(
    request: OpenShellRejectRequestRequest,
  ): Promise<OpenShellManagementResult<void>> {
    return ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_REJECT_REQUEST, request);
  },
};

export default agentAccess;
