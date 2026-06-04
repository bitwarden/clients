import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { AccessApprovalOutcome } from "./access-pre-check.response";
import { LeaseModelResponse } from "./lease-model.response";
import { LeaseRequestModelResponse } from "./lease-request-model.response";

/**
 * Server envelope returned by `POST /ciphers/{id}/lease`. Exactly one of
 * {@link lease} (automatic outcome) and {@link request} (human outcome) is
 * populated; the other is `null`.
 */
export class AccessRequestEnvelopeResponse extends BaseResponse {
  outcome: AccessApprovalOutcome;
  lease: LeaseModelResponse | null;
  request: LeaseRequestModelResponse | null;

  constructor(response: unknown) {
    super(response);
    this.outcome = this.getResponseProperty("Outcome");
    const lease = this.getResponseProperty("Lease");
    this.lease = lease ? new LeaseModelResponse(lease) : null;
    const request = this.getResponseProperty("Request");
    this.request = request ? new LeaseRequestModelResponse(request) : null;
  }
}
