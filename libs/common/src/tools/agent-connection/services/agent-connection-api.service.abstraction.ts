import { ListResponse } from "../../../models/response/list.response";
import { AgentConnectionRequest } from "../models/request/agent-connection.request";
import { AgentConnectionResponse } from "../models/response/agent-connection.response";

export abstract class AgentConnectionApiService {
  /** Creates an agent connection. The request carries the user-key-encrypted PSK (ciphertext). */
  abstract post(request: AgentConnectionRequest): Promise<AgentConnectionResponse>;
  /** Lists the authenticated user's agent connections. */
  abstract getAll(): Promise<ListResponse<AgentConnectionResponse>>;
  /** Revokes (deletes) an agent connection by id. */
  abstract delete(id: string): Promise<void>;
}
