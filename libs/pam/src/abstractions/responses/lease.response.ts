import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export type LeaseStatus = "active" | "expired" | "revoked";

export class LeaseResponse extends BaseResponse {
  id: string;
  requestId: string;
  cipherId: string;
  collectionId: string;
  /** The rule the lease was granted under (carries the lease constraints). */
  ruleId: string | null;
  /** Owning organization, surfaced for org-scoped operations (kill switch / freeze). */
  organizationId: string | null;
  granteeUserId: string;
  notBefore: string;
  notAfter: string;
  status: LeaseStatus;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revocationReason: string | null;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.requestId = this.getResponseProperty("RequestId");
    this.cipherId = this.getResponseProperty("CipherId");
    this.collectionId = this.getResponseProperty("CollectionId");
    this.ruleId = this.getResponseProperty("RuleId") ?? null;
    this.organizationId = this.getResponseProperty("OrganizationId") ?? null;
    this.granteeUserId = this.getResponseProperty("GranteeUserId");
    this.notBefore = this.getResponseProperty("NotBefore");
    this.notAfter = this.getResponseProperty("NotAfter");
    this.status = this.getResponseProperty("Status");
    this.revokedAt = this.getResponseProperty("RevokedAt") ?? null;
    this.revokedByUserId = this.getResponseProperty("RevokedByUserId") ?? null;
    this.revocationReason = this.getResponseProperty("RevocationReason") ?? null;
  }
}
