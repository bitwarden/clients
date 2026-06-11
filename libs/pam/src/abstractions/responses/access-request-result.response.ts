import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { AccessApprovalMode } from "./access-pre-check.response";
import { AccessRequestResponse } from "./access-request.response";

/**
 * Result of submitting an access request via `POST /ciphers/{id}/lease`. No lease is
 * minted at submit on either path: the automatic path returns an already-approved
 * {@link request} the caller activates to start the lease, while the human path
 * returns a pending {@link request} awaiting an approver. {@link approvalMode} tells
 * the client which workflow to present.
 */
export class AccessRequestResultResponse extends BaseResponse {
  approvalMode: AccessApprovalMode;
  request: AccessRequestResponse | null;

  constructor(response: unknown) {
    super(response);
    this.approvalMode = this.getResponseProperty("ApprovalMode");
    const request = this.getResponseProperty("Request");
    this.request = request ? new AccessRequestResponse(request) : null;
  }
}
