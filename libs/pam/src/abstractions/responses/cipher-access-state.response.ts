import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { AccessLeaseResponse } from "./access-lease.response";
import { AccessRequestDetailsResponse } from "./access-request-details.response";

/**
 * Wire-format snapshot returned by `GET /ciphers/{cipherId}/lease/state`.
 *
 * Carries the three caller-scoped pieces of access state the cipher view
 * banner and vault-row badge need to render: the active lease (if any), an
 * in-flight pending request (if any), and an approved-but-not-yet-activated
 * request (always null in v0 — approval mints the lease immediately).
 *
 * The service maps this DTO to the consumer-facing `CipherAccessState` shape
 * before handing it to components.
 */
export class CipherAccessStateResponse extends BaseResponse {
  cipherId: string;
  activeLease: AccessLeaseResponse | null;
  pendingRequest: AccessRequestDetailsResponse | null;
  approvedRequest: AccessRequestDetailsResponse | null;

  constructor(response: unknown) {
    super(response);
    this.cipherId = this.getResponseProperty("CipherId");
    const activeLease = this.getResponseProperty("ActiveLease");
    this.activeLease = activeLease != null ? new AccessLeaseResponse(activeLease) : null;
    const pendingRequest = this.getResponseProperty("PendingRequest");
    this.pendingRequest =
      pendingRequest != null ? new AccessRequestDetailsResponse(pendingRequest) : null;
    const approvedRequest = this.getResponseProperty("ApprovedRequest");
    this.approvedRequest =
      approvedRequest != null ? new AccessRequestDetailsResponse(approvedRequest) : null;
  }
}
