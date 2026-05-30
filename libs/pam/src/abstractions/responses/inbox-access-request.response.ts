import { AccessRequestResponse } from "./access-request.response";

/**
 * Denormalized lease request returned by the approver inbox endpoint.
 *
 * The inbox endpoint joins the cipher, collection, and requester records
 * server-side so the frontend can render rows without follow-up fetches.
 * Only display metadata is included — never decrypted Vault Data.
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
