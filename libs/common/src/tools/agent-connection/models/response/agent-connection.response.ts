import { BaseResponse } from "../../../../models/response/base.response";

/**
 * API response for an {@link AgentConnection} returned by the server (sync and the
 * `/agent-connections` endpoints). `key` is the user-key-encrypted agent-access PSK; the server
 * stores and relays it as ciphertext only and cannot decrypt it.
 */
export class AgentConnectionResponse extends BaseResponse {
  id: string;
  partnerClientId: string;
  name: string;
  key: string;
  creationDate: string;
  revisionDate: string;
  revokedDate: string | null;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.partnerClientId = this.getResponseProperty("PartnerClientId");
    this.name = this.getResponseProperty("Name");
    this.key = this.getResponseProperty("Key");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
    this.revokedDate = this.getResponseProperty("RevokedDate") ?? null;
  }
}
