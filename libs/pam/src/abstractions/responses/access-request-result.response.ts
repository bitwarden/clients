import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { AccessLeaseResponse } from "./access-lease.response";
import { AccessApprovalMode } from "./access-pre-check.response";
import { AccessRequestResponse } from "./access-request.response";

/**
 * Result of submitting an access request via `POST /ciphers/{id}/lease`.
 * Exactly one of {@link lease} (automatic approval) and {@link request}
 * (human approval) is populated; the other is `null`.
 */
export class AccessRequestResultResponse extends BaseResponse {
  approvalMode: AccessApprovalMode;
  lease: AccessLeaseResponse | null;
  request: AccessRequestResponse | null;

  constructor(response: unknown) {
    super(response);
    this.approvalMode = this.getResponseProperty("ApprovalMode");
    const lease = this.getResponseProperty("Lease");
    this.lease = lease ? new AccessLeaseResponse(lease) : null;
    const request = this.getResponseProperty("Request");
    this.request = request ? new AccessRequestResponse(request) : null;
  }
}
