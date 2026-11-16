// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AgentConnection } from "../domain/agent-connection";

/**
 * Create request for an agent connection. `key` is the user-key-encrypted PSK
 * (`encryptedString`); the server stores it as ciphertext only. `partnerClientId` is validated by
 * the server against the user's pending authorize/consent context — it is not trusted as a
 * free-form value.
 */
export class AgentConnectionRequest {
  partnerClientId: string;
  name: string;
  key: string;

  constructor(connection: AgentConnection) {
    this.partnerClientId = connection.partnerClientId;
    this.name = connection.name;
    this.key = connection.key?.encryptedString ?? null;
  }
}
