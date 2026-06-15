import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * The approval path resolved for a cipher's governing access rule, side-effect-free.
 * - `automatic`: submitting an access request mints an active lease immediately.
 * - `human`: submitting creates a pending request that an approver must resolve.
 */
export const AccessApprovalMode = Object.freeze({
  Automatic: "automatic",
  Human: "human",
} as const);
export type AccessApprovalMode = (typeof AccessApprovalMode)[keyof typeof AccessApprovalMode];

export class AccessPreCheckResponse extends BaseResponse {
  cipherId: string;
  approvalMode: AccessApprovalMode;
  /** True when the caller already holds an active lease: reveal the credential, no request needed. */
  hasActiveLease: boolean;

  constructor(response: unknown) {
    super(response);
    this.cipherId = this.getResponseProperty("CipherId");
    this.approvalMode = this.getResponseProperty("ApprovalMode");
    this.hasActiveLease = this.getResponseProperty("HasActiveLease") ?? false;
  }
}
