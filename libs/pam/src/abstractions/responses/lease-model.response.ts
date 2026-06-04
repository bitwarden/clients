import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * Lifecycle status of a lease as emitted by the lease pre-check / request-lease
 * endpoints (integer wire format). Distinct from the richer string `LeaseStatus`
 * the mock and existing ticket-lifecycle surfaces use.
 */
export const LeaseLifecycleStatus = Object.freeze({
  Active: 0,
  Expired: 1,
  Revoked: 2,
} as const);
export type LeaseLifecycleStatus = (typeof LeaseLifecycleStatus)[keyof typeof LeaseLifecycleStatus];

/**
 * Server `LeaseModel` envelope returned by `POST /ciphers/{id}/lease` on the
 * automatic path. Strictly the fields the server emits — no ticket/grantee/
 * revocation metadata.
 */
export class LeaseModelResponse extends BaseResponse {
  id: string;
  cipherId: string;
  collectionId: string;
  organizationId: string;
  status: LeaseLifecycleStatus;
  notBefore: string;
  notAfter: string;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.cipherId = this.getResponseProperty("CipherId");
    this.collectionId = this.getResponseProperty("CollectionId");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.status = this.getResponseProperty("Status");
    this.notBefore = this.getResponseProperty("NotBefore");
    this.notAfter = this.getResponseProperty("NotAfter");
  }
}
