import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export type LeaseRequestStatus = "pending" | "approved" | "denied" | "cancelled" | "expired";

export class LeaseRequestResponse extends BaseResponse {
  id: string;
  cipherId: string;
  collectionId: string;
  requesterUserId: string;
  status: LeaseRequestStatus;
  requestedNotBefore: string | null;
  requestedNotAfter: string | null;
  requestedTtlSeconds: number;
  reason: string | null;
  submittedAt: string;
  resolvedAt: string | null;
  resolverUserId: string | null;
  resolverComment: string | null;
  leaseId: string | null;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.cipherId = this.getResponseProperty("CipherId");
    this.collectionId = this.getResponseProperty("CollectionId");
    this.requesterUserId = this.getResponseProperty("RequesterUserId");
    this.status = this.getResponseProperty("Status");
    this.requestedNotBefore = this.getResponseProperty("RequestedNotBefore") ?? null;
    this.requestedNotAfter = this.getResponseProperty("RequestedNotAfter") ?? null;
    this.requestedTtlSeconds = this.getResponseProperty("RequestedTtlSeconds");
    this.reason = this.getResponseProperty("Reason") ?? null;
    this.submittedAt = this.getResponseProperty("SubmittedAt");
    this.resolvedAt = this.getResponseProperty("ResolvedAt") ?? null;
    this.resolverUserId = this.getResponseProperty("ResolverUserId") ?? null;
    this.resolverComment = this.getResponseProperty("ResolverComment") ?? null;
    this.leaseId = this.getResponseProperty("LeaseId") ?? null;
  }
}
