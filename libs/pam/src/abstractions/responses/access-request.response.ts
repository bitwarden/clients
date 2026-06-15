import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * Lifecycle of an access request.
 *
 * An `approved` request means the approver has granted access. In v0 approval
 * mints the lease immediately; in the activation model the requester activates
 * the approved request, which mints the lease and moves the request to
 * `activated`. An approved request left unactivated past its activation
 * deadline transitions to `expired`.
 */
export const AccessRequestStatus = Object.freeze({
  Pending: "pending",
  Approved: "approved",
  Activated: "activated",
  Denied: "denied",
  Cancelled: "cancelled",
  Expired: "expired",
} as const);
export type AccessRequestStatus = (typeof AccessRequestStatus)[keyof typeof AccessRequestStatus];

/**
 * A plain access-request row, as returned inside the submission result
 * envelope of `POST /ciphers/{id}/lease` on the human path. The richer
 * `AccessRequestDetailsResponse` adds approver and display fields.
 */
export class AccessRequestResponse extends BaseResponse {
  id: string;
  cipherId: string;
  collectionId: string;
  organizationId: string;
  status: AccessRequestStatus;
  notBefore: string;
  notAfter: string;
  reason: string | null;
  creationDate: string;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.cipherId = this.getResponseProperty("CipherId");
    this.collectionId = this.getResponseProperty("CollectionId");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.status = this.getResponseProperty("Status");
    this.notBefore = this.getResponseProperty("NotBefore");
    this.notAfter = this.getResponseProperty("NotAfter");
    this.reason = this.getResponseProperty("Reason") ?? null;
    this.creationDate = this.getResponseProperty("CreationDate");
  }
}
