import { Observable } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { UserKeyRotationDataProvider } from "@bitwarden/key-management";

import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { AgentConnectionData } from "../models/data/agent-connection.data";
import { AgentConnection } from "../models/domain/agent-connection";
import { AgentConnectionWithIdRequest } from "../models/request/agent-connection-with-id.request";
import { AgentConnectionView } from "../models/view/agent-connection.view";

export abstract class AgentConnectionService implements UserKeyRotationDataProvider<AgentConnectionWithIdRequest> {
  abstract agentConnections$: Observable<AgentConnection[]>;
  abstract agentConnectionViews$: Observable<AgentConnectionView[]>;

  /**
   * Builds an encrypted {@link AgentConnection} by wrapping the plaintext PSK under the user key.
   * @param plaintextPsk Protected Data — the plaintext agent-access PSK. Never logged or persisted.
   */
  abstract encrypt(
    partnerClientId: string,
    name: string,
    plaintextPsk: string,
    userId: UserId,
  ): Promise<AgentConnection>;

  /** Re-wraps each connection's PSK under the new user key for the account key-rotation flow. */
  abstract getRotatedData(
    originalUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<AgentConnectionWithIdRequest[]>;
}

export abstract class InternalAgentConnectionService extends AgentConnectionService {
  abstract upsert(connection: AgentConnectionData | AgentConnectionData[]): Promise<void>;
  abstract replace(connections: Record<string, AgentConnectionData>, userId: UserId): Promise<void>;
  abstract delete(id: string | string[]): Promise<void>;
}
