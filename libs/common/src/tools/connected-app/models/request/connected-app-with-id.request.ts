import { ConnectedApp } from "../domain/connected-app";

import { ConnectedAppRequest } from "./connected-app.request";

/**
 * Agent-connection request carrying its id, used by the account key-rotation flow to submit each
 * connection's PSK re-wrapped under the new user key.
 */
export class ConnectedAppWithIdRequest extends ConnectedAppRequest {
  id: string;

  constructor(connection: ConnectedApp) {
    super(connection);
    this.id = connection.id;
  }
}
