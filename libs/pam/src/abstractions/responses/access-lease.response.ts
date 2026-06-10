import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export type AccessLeaseStatus = "active" | "expired" | "revoked";

/**
 * An access lease as its requester sees it: the originating request, string
 * status vocabulary, and revocation fields. Returned by the submission result
 * envelope, "my active leases", and the cipher access-state snapshot.
 */
export class AccessLeaseResponse extends BaseResponse {
  id: string;
  requestId: string;
  cipherId: string;
  collectionId: string;
  /** The rule the lease was granted under (carries the lease constraints). */
  ruleId: string | null;
  /** Owning organization, surfaced for org-scoped operations (kill switch / freeze). */
  organizationId: string | null;
  /** The user the lease was granted to (the original requester). */
  requesterId: string;
  notBefore: string;
  notAfter: string;
  status: AccessLeaseStatus;
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
    this.requesterId = this.getResponseProperty("RequesterId");
    this.notBefore = this.getResponseProperty("NotBefore");
    this.notAfter = this.getResponseProperty("NotAfter");
    this.status = this.getResponseProperty("Status");
    this.revokedAt = this.getResponseProperty("RevokedAt") ?? null;
    this.revokedByUserId = this.getResponseProperty("RevokedByUserId") ?? null;
    this.revocationReason = this.getResponseProperty("RevocationReason") ?? null;
  }
}
