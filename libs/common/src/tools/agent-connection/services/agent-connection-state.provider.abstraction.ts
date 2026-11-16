// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";
import type { Simplify } from "type-fest";

import { CombinedState } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { AgentConnectionData } from "../models/data/agent-connection.data";

type EncryptedAgentConnectionState = Simplify<CombinedState<Record<string, AgentConnectionData>>>;

export abstract class AgentConnectionStateProvider {
  encryptedState$: Observable<EncryptedAgentConnectionState>;

  getEncryptedAgentConnections: () => Promise<EncryptedAgentConnectionState>;

  setEncryptedAgentConnections: (
    value: Record<string, AgentConnectionData>,
    userId: UserId,
  ) => Promise<void>;
}
