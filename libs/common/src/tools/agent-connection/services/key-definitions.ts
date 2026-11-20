import { AGENT_CONNECTION_DISK, UserKeyDefinition } from "../../../platform/state";
import { AgentConnectionData } from "../models/data/agent-connection.data";

/** Encrypted agent-connection state (keyed by connection id) stored on disk. */
export const AGENT_CONNECTION_USER_ENCRYPTED = UserKeyDefinition.record<AgentConnectionData>(
  AGENT_CONNECTION_DISK,
  "agentConnectionUserEncrypted",
  {
    deserializer: (obj: AgentConnectionData) => obj,
    clearOn: ["logout"],
  },
);
