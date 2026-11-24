import { ListResponse } from "../../../models/response/list.response";
import { ConnectedAppRequest } from "../models/request/connected-app.request";
import { ConnectedAppResponse } from "../models/response/connected-app.response";

export abstract class ConnectedAppApiService {
  /** Creates an agent connection. The request carries the user-key-encrypted PSK (ciphertext). */
  abstract post(request: ConnectedAppRequest): Promise<ConnectedAppResponse>;
  /** Lists the authenticated user's agent connections. */
  abstract getAll(): Promise<ListResponse<ConnectedAppResponse>>;
  /** Revokes (deletes) an agent connection by id. */
  abstract delete(id: string): Promise<void>;
}
