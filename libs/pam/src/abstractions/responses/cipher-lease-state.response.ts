import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { AccessRequestResponse } from "./access-request.response";
import { LeaseResponse } from "./lease.response";

/**
 * Wire-format envelope returned by `GET /ciphers/{cipherId}/lease/state`.
 *
 * Carries the three caller-scoped pieces of leasing state the cipher view
 * banner and vault-row badge need to render: the active lease (if any), an
 * in-flight pending request (if any), and an approved-but-unredeemed ticket
 * (if any). See `docs/pam-backend-spec.md` §2 for field rules.
 *
 * The service maps this DTO to the consumer-facing `CipherAccessState` shape
 * before handing it to components.
 */
export class CipherLeaseStateResponse extends BaseResponse {
  cipherId: string;
  activeLease: LeaseResponse | null;
  pendingRequest: AccessRequestResponse | null;
  approvedTicket: AccessRequestResponse | null;

  constructor(response: unknown) {
    super(response);
    this.cipherId = this.getResponseProperty("CipherId");
    const lease = this.getResponseProperty("Lease");
    const activeLease = lease != null ? this.getResponseProperty("ActiveLease", lease) : null;
    this.activeLease = activeLease != null ? new LeaseResponse(activeLease) : null;
    const pendingRequest = lease != null ? this.getResponseProperty("PendingRequest", lease) : null;
    this.pendingRequest = pendingRequest != null ? new AccessRequestResponse(pendingRequest) : null;
    const approvedTicket = lease != null ? this.getResponseProperty("ApprovedTicket", lease) : null;
    this.approvedTicket = approvedTicket != null ? new AccessRequestResponse(approvedTicket) : null;
  }
}
