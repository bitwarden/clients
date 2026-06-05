import { AccessRequestResponse } from "./access-request.response";

/**
 * Denormalized lease request returned by the approver inbox endpoint.
 *
 * The inbox endpoint joins the cipher, collection, and requester records
 * server-side so the frontend can render rows without follow-up fetches.
 *
 * `cipherName` and `collectionName` arrive as encrypted blobs (EncString
 * payload strings), not plaintext — the approver inbox service decrypts both
 * with the owning org's key before pushing rows to subscribers. No other
 * cipher field is exposed on this endpoint.
 *
 * The decision endpoint (`POST /leasing/requests/{id}/decision`) returns this
 * shape but only `status`, `resolvedAt`, and `resolverComment` are guaranteed
 * to be populated; denormalized display fields and `leaseId` come back null.
 */
export class InboxAccessRequestResponse extends AccessRequestResponse {
  cipherName: string;
  collectionName: string;
  requesterName: string | null;
  requesterEmail: string;

  constructor(response: unknown) {
    super(response);
    this.cipherName = this.getResponseProperty("CipherName");
    this.collectionName = this.getResponseProperty("CollectionName");
    this.requesterName = this.getResponseProperty("RequesterName") ?? null;
    this.requesterEmail = this.getResponseProperty("RequesterEmail");
  }
}
