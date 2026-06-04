import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * Lifecycle status of a lease request as emitted by the request-lease endpoint
 * (integer wire format). A newly created human request is `Pending`.
 */
export const LeaseRequestLifecycleStatus = Object.freeze({
  Pending: 0,
  Approved: 1,
  Denied: 2,
  Cancelled: 3,
  ExpiredUnanswered: 4,
} as const);
export type LeaseRequestLifecycleStatus =
  (typeof LeaseRequestLifecycleStatus)[keyof typeof LeaseRequestLifecycleStatus];

/**
 * Server `LeaseRequestModel` envelope returned by `POST /ciphers/{id}/lease` on
 * the human path. Field shape mirrors the server exactly — note `notBefore` /
 * `notAfter` / `creationDate` (not the `requested*` / `submittedAt` of the
 * richer client-side {@link LeaseRequestResponse}).
 */
export class LeaseRequestModelResponse extends BaseResponse {
  id: string;
  cipherId: string;
  collectionId: string;
  organizationId: string;
  status: LeaseRequestLifecycleStatus;
  notBefore: string;
  notAfter: string;
  reason: string | null;
  creationDate: string;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.cipherId = this.getResponseProperty("CipherId");
    this.collectionId = this.getResponseProperty("CollectionId");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.status = this.getResponseProperty("Status");
    this.notBefore = this.getResponseProperty("NotBefore");
    this.notAfter = this.getResponseProperty("NotAfter");
    this.reason = this.getResponseProperty("Reason") ?? null;
    this.creationDate = this.getResponseProperty("CreationDate");
  }
}
