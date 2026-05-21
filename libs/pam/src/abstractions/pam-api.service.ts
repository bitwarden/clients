import { Observable } from "rxjs";

import { CollectionLeasingRequest } from "../services/requests/collection-leasing.request";
import { LeaseDecisionRequest } from "../services/requests/lease-decision.request";
import { LeaseExtensionRequest } from "../services/requests/lease-extension.request";
import { LeaseRequestPatchRequest } from "../services/requests/lease-request-patch.request";
import { LeaseRevokeRequest } from "../services/requests/lease-revoke.request";

import { GatedCipherFetchResult } from "./gated-cipher-fetch-result";
import { CollectionLeasingConfigResponse } from "./responses/collection-leasing.response";
import { OrganizationGovernanceSummaryResponse } from "./responses/governance-summary.response";
import { InboxBadgeCountResponse } from "./responses/inbox-badge-count.response";
import { InboxLeaseRequestResponse } from "./responses/inbox-lease-request.response";
import { LeaseRequestResponse } from "./responses/lease-request.response";
import { LeaseResponse } from "./responses/lease.response";

/**
 * Result of a bulk revoke operation. The server returns a partial-failure shape
 * when some leases could not be revoked (e.g. concurrent expiry). This type
 * mirrors the assumed response shape — coordinate with the server team to
 * finalise before the endpoint ships. See PM-37278.
 */
export type BulkRevokeResult =
  | { kind: "ok"; revokedCount: number }
  | {
      kind: "partial";
      revokedCount: number;
      failedCount: number;
      failures: { leaseId: string; reason: string }[];
    };

/**
 * Snapshot of the current user's relationship to a single cipher's lease:
 * whether they hold an active lease, have a pending request, or neither.
 */
export type CipherLeaseState = {
  activeLease?: LeaseResponse;
  pendingRequest?: LeaseRequestResponse;
};

export abstract class PamApiService {
  abstract fetchGatedCipher(id: string): Promise<GatedCipherFetchResult>;

  /**
   * Observe the current user's lease state for one cipher. Emits on subscribe
   * and again whenever the state changes (approval, denial, expiry, revoke).
   */
  abstract getCipherLeaseState$(cipherId: string, userId: string): Observable<CipherLeaseState>;
  abstract patchLeaseRequest(
    id: string,
    request: LeaseRequestPatchRequest,
  ): Promise<LeaseRequestResponse>;
  abstract cancelLeaseRequest(id: string): Promise<void>;
  abstract requestLeaseExtension(request: LeaseExtensionRequest): Promise<LeaseRequestResponse>;
  abstract decideLeaseRequest(
    id: string,
    request: LeaseDecisionRequest,
  ): Promise<LeaseRequestResponse>;
  abstract revokeLease(id: string, request: LeaseRevokeRequest): Promise<void>;
  abstract setCollectionLeasingConfig(
    id: string,
    request: CollectionLeasingRequest,
  ): Promise<CollectionLeasingConfigResponse>;
  abstract listMyRequests(): Promise<LeaseRequestResponse[]>;
  abstract getCollectionLeasingConfig(id: string): Promise<CollectionLeasingConfigResponse>;
  abstract listActiveLeases(): Promise<LeaseResponse[]>;
  /**
   * Fetch the leasing governance summary for an organization — org-wide totals
   * and a row per leasing-enabled collection. Org-admin only on the server.
   * See PM-37277.
   */
  abstract getGovernanceSummary(
    organizationId: string,
  ): Promise<OrganizationGovernanceSummaryResponse>;

  /**
   * Revoke all active leases for an organization in a single call (kill switch).
   * The server generates an audit-log entry per revoked lease. Org-admin only.
   * See PM-37278.
   */
  abstract bulkRevokeLeases(organizationId: string): Promise<BulkRevokeResult>;
  /**
   * List pending lease requests for collections the caller can Manage.
   * Server filters by the caller's permissions; the frontend never decides
   * who an approver is.
   */
  abstract listInboxRequests(): Promise<InboxLeaseRequestResponse[]>;
  /**
   * Submit an approve/deny decision for a single lease request.
   * Convenience wrapper around the existing decision endpoint, named to
   * match the inbox interaction.
   */
  abstract submitDecision(
    requestId: string,
    request: LeaseDecisionRequest,
  ): Promise<LeaseRequestResponse>;
  /**
   * Pending lease-request count visible to the caller, for the nav badge.
   */
  abstract getInboxBadgeCount(): Promise<InboxBadgeCountResponse>;
  /**
   * Fetch a single lease request by ID. Used by the email deep-link route so
   * the locked-vault approval surface can render request details without
   * decrypting any vault data.
   */
  abstract getLeaseRequest(id: string): Promise<InboxLeaseRequestResponse>;
}
