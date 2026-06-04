import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * The approval route resolved for a cipher's gating rule, side-effect-free.
 * - `automatic`: submitting a lease request mints an active lease immediately.
 * - `human`: submitting creates a pending request that an approver must resolve.
 */
export type AccessApprovalOutcome = "automatic" | "human";

export class AccessPreCheckResponse extends BaseResponse {
  cipherId: string;
  outcome: AccessApprovalOutcome;

  constructor(response: unknown) {
    super(response);
    this.cipherId = this.getResponseProperty("CipherId");
    this.outcome = this.getResponseProperty("Outcome");
  }
}
