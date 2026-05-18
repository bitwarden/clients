import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { LeasingPolicy, parseLeasingPolicy } from "../leasing-policy";

/**
 * One row in the organization governance dashboard — one leasing-enabled
 * collection. Drives the per-collection table that satisfies requirement N6.
 */
export class CollectionGovernanceRowResponse extends BaseResponse {
  collectionId: string;
  collectionName: string;
  policy: LeasingPolicy | null;
  /** Members of the collection whose membership has `require_lease = true`. */
  requireLeaseMemberCount: number;
  /** Lease requests on this collection currently in the `pending` state. */
  pendingRequestCount: number;
  /** Active (non-expired, non-revoked) leases scoped to this collection. */
  activeLeaseCount: number;
  /** ISO 8601 timestamp of the most recent leasing event, or null if none. */
  lastActivityAt: string | null;

  constructor(response: unknown) {
    super(response);
    this.collectionId = this.getResponseProperty("CollectionId");
    this.collectionName = this.getResponseProperty("CollectionName");
    const policy = this.getResponseProperty("Policy");
    this.policy = policy == null ? null : parseLeasingPolicy(policy);
    this.requireLeaseMemberCount = this.getResponseProperty("RequireLeaseMemberCount") ?? 0;
    this.pendingRequestCount = this.getResponseProperty("PendingRequestCount") ?? 0;
    this.activeLeaseCount = this.getResponseProperty("ActiveLeaseCount") ?? 0;
    this.lastActivityAt = this.getResponseProperty("LastActivityAt") ?? null;
  }
}

/**
 * Top-level shape returned by `GET /organizations/{id}/leasing/governance`.
 *
 * The server pre-aggregates counts so the dashboard renders in one round-trip
 * — clients do not enumerate per-collection sublists for the strip totals.
 */
export class OrganizationGovernanceSummaryResponse extends BaseResponse {
  organizationId: string;
  /** Distinct collections with `leasingEnabled = true`. */
  leasingEnabledCollectionCount: number;
  /** Total pending lease requests across the organization. */
  totalPendingRequestCount: number;
  /** Total active leases across the organization. */
  totalActiveLeaseCount: number;
  collections: CollectionGovernanceRowResponse[];

  constructor(response: unknown) {
    super(response);
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.leasingEnabledCollectionCount =
      this.getResponseProperty("LeasingEnabledCollectionCount") ?? 0;
    this.totalPendingRequestCount = this.getResponseProperty("TotalPendingRequestCount") ?? 0;
    this.totalActiveLeaseCount = this.getResponseProperty("TotalActiveLeaseCount") ?? 0;
    const collections = this.getResponseProperty("Collections") ?? [];
    this.collections = (collections as unknown[]).map(
      (row) => new CollectionGovernanceRowResponse(row),
    );
  }
}
