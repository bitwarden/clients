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
  ): Promise<void> => {
    await ipcRenderer.invoke(AGENT_ACCESS_IPC_CHANNELS.CREDENTIAL_REQUEST_RESPONSE, {
      requestId,
      response,
      outcome,
    });
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
};

export default agentAccess;
