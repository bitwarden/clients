import { AgentConnection } from "../domain/agent-connection";

import { AgentConnectionRequest } from "./agent-connection.request";

/**
 * Agent-connection request carrying its id, used by the account key-rotation flow to submit each
 * connection's PSK re-wrapped under the new user key.
 */
export class AgentConnectionWithIdRequest extends AgentConnectionRequest {
  id: string;

  constructor(connection: AgentConnection) {
    super(connection);
    this.id = connection.id;
  }
}
