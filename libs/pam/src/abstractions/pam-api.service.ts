import { Observable } from "rxjs";

import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { AccessRuleRequest } from "../services/requests/access-rule.request";
import { LeaseDecisionRequest } from "../services/requests/lease-decision.request";
import { LeaseExtensionRequest } from "../services/requests/lease-extension.request";
import { AccessRequestPatchRequest } from "../services/requests/access-request-patch.request";
import { LeaseRevokeRequest } from "../services/requests/lease-revoke.request";

import { GatedCipherFetchResult } from "./gated-cipher-fetch-result";
import { AccessRuleResponse } from "./responses/access-rule.response";
import { AccessRequestResponse } from "./responses/access-request.response";
import { BulkRevokeResult } from "./responses/bulk-revoke.result";
import { OrganizationGovernanceSummaryResponse } from "./responses/governance-summary.response";
import { InboxAccessRequestResponse } from "./responses/inbox-access-request.response";
import { InboxBadgeCountResponse } from "./responses/inbox-badge-count.response";
import { LeaseResponse } from "./responses/lease.response";

/**
 * Snapshot of a cipher's leasing state from the perspective of the current
 * user — what the badge/banner need to render.
 */
export type CipherAccessState = {
  lease: {
    activeLease?: LeaseResponse;
    pendingRequest?: AccessRequestResponse;
    /**
     * An approved-but-unredeemed ticket: the banner offers "Start access"
     * (MemberStartsLease) rather than creating a duplicate request.
     */
    approvedTicket?: AccessRequestResponse;
  };
};

export abstract class PamApiService {
  abstract fetchGatedCipher(id: string): Promise<GatedCipherFetchResult>;
  abstract getCipherAccessState$(cipherId: string, userId: string): Observable<CipherAccessState>;
  abstract patchAccessRequest(
    id: string,
    request: AccessRequestPatchRequest,
  ): Promise<AccessRequestResponse>;
  abstract cancelAccessRequest(id: string): Promise<void>;
  abstract requestLeaseExtension(request: LeaseExtensionRequest): Promise<AccessRequestResponse>;
  abstract decideAccessRequest(
    id: string,
    request: LeaseDecisionRequest,
  ): Promise<AccessRequestResponse>;
  /**
   * Redeems an approved ticket (MemberStartsLease): mints the lease at a time of
   * the requester's choosing and moves the request to `activated`. Rejected when
   * the rule's single-active-lease slot is taken or the org is under a leasing
   * freeze; the ticket stays redeemable for a manual retry.
   */
  abstract startLease(requestId: string): Promise<LeaseResponse>;
  abstract revokeLease(id: string, request: LeaseRevokeRequest): Promise<void>;

  abstract listInboxRequests(): Promise<InboxAccessRequestResponse[]>;
  abstract listInboxHistory(): Promise<InboxAccessRequestResponse[]>;
  abstract getInboxBadgeCount(): Promise<InboxBadgeCountResponse>;
  abstract listMyRequests(): Promise<AccessRequestResponse[]>;
  abstract listActiveLeases(): Promise<LeaseResponse[]>;

  abstract getGovernanceSummary(
    organizationId: string,
  ): Promise<OrganizationGovernanceSummaryResponse>;
  /**
   * Org-wide kill switch: revokes all active leases in the organization. When
   * `blockNewLeases` is true, also engages a leasing freeze so no ticket can be
   * redeemed until {@link unblockNewLeases} lifts it.
   */
  abstract bulkRevokeLeases(
    organizationId: string,
    blockNewLeases: boolean,
  ): Promise<BulkRevokeResult>;
  /** Lifts an org-wide leasing freeze so tickets can be redeemed again. */
  abstract unblockNewLeases(organizationId: string): Promise<void>;
  /** Whether the organization is currently under a leasing freeze. */
  abstract isLeasingFrozen(organizationId: string): Promise<boolean>;

  abstract listAccessRules(organizationId: string): Promise<ListResponse<AccessRuleResponse>>;
  abstract getAccessRule(organizationId: string, id: string): Promise<AccessRuleResponse>;
  abstract createAccessRule(
    organizationId: string,
    request: AccessRuleRequest,
  ): Promise<AccessRuleResponse>;
  abstract updateAccessRule(
    organizationId: string,
    id: string,
    request: AccessRuleRequest,
  ): Promise<AccessRuleResponse>;
  abstract deleteAccessRule(organizationId: string, id: string): Promise<void>;
}
