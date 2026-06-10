import { Observable } from "rxjs";

import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";

import { AccessDecisionRequest } from "../services/requests/access-decision.request";
import { AccessLeaseExtensionRequest } from "../services/requests/access-lease-extension.request";
import { AccessLeaseRevokeRequest } from "../services/requests/access-lease-revoke.request";
import { AccessRequestCreateRequest } from "../services/requests/access-request-create.request";
import { AccessRequestPatchRequest } from "../services/requests/access-request-patch.request";
import { AccessRuleRequest } from "../services/requests/access-rule.request";

import { GatedCipherFetchResult } from "./gated-cipher-fetch-result";
import { AccessLeaseResponse } from "./responses/access-lease.response";
import { AccessPreCheckResponse } from "./responses/access-pre-check.response";
import { AccessRequestDetailsResponse } from "./responses/access-request-details.response";
import { AccessRequestResultResponse } from "./responses/access-request-result.response";
import { AccessRuleResponse } from "./responses/access-rule.response";
import { BulkRevokeResult } from "./responses/bulk-revoke.result";
import { OrganizationGovernanceSummaryResponse } from "./responses/governance-summary.response";

/**
 * Snapshot of a cipher's access state from the perspective of the current
 * user — what the badge/banner need to render.
 */
export type CipherAccessState = {
  activeLease?: AccessLeaseResponse;
  pendingRequest?: AccessRequestDetailsResponse;
  /**
   * An approved-but-not-yet-activated request: the banner offers "Start access"
   * (activation) rather than creating a duplicate request.
   */
  approvedRequest?: AccessRequestDetailsResponse;
};

export abstract class PamApiService {
  /**
   * Emits after every successful locally-initiated mutation (request created,
   * cancelled, decided, revoked, extended, …). Surfaces whose state aggregates
   * leasing data (e.g. the approver-inbox nav badge) refresh on it without
   * waiting for the server push channel.
   */
  abstract readonly mutations$: Observable<void>;
  abstract fetchGatedCipher(id: string): Promise<GatedCipherFetchResult>;
  abstract getCipherAccessState$(cipherId: string, userId: string): Observable<CipherAccessState>;
  /**
   * Side-effect-free check that resolves which approval workflow (`automatic`
   * or `human`) applies for the caller on this cipher. Returns 404 when the
   * cipher isn't visible to the caller or the PAM feature flag is off.
   */
  abstract getAccessPreCheck(cipherId: string): Promise<AccessPreCheckResponse>;
  /**
   * Creates an active lease (automatic) or a pending lease request (human),
   * depending on the server's re-evaluated approval requirement and the body
   * shape. The server rejects (400) if the body doesn't match the resolved
   * outcome — see the lease-request frontend handover for the error catalog.
   */
  abstract submitAccessRequest(
    cipherId: string,
    body: AccessRequestCreateRequest,
  ): Promise<AccessRequestResultResponse>;
  /**
   * Returns the cipher with its complete (encrypted) data — only when the
   * caller currently holds an active lease covering it. 404 if no active lease
   * (or the cipher isn't visible, or the PAM flag is off). The response is
   * NOT persisted into the local cipher cache: callers should treat it as
   * transient and re-fetch on every view.
   */
  abstract getLeasedCipher(cipherId: string): Promise<CipherResponse>;
  abstract patchAccessRequest(
    id: string,
    request: AccessRequestPatchRequest,
  ): Promise<AccessRequestDetailsResponse>;
  abstract cancelAccessRequest(id: string): Promise<void>;
  abstract requestLeaseExtension(
    request: AccessLeaseExtensionRequest,
  ): Promise<AccessRequestDetailsResponse>;
  abstract decideAccessRequest(
    id: string,
    request: AccessDecisionRequest,
  ): Promise<AccessRequestDetailsResponse>;
  /**
   * Activates an approved request: mints the lease at a time of the requester's
   * choosing and moves the request to `activated`. Rejected when the request is
   * not approved, its window has not started or has ended, or its access was
   * already used (revoked/lapsed lease); repeat calls while the produced lease
   * is live return that lease.
   */
  abstract activateLease(requestId: string): Promise<AccessLeaseResponse>;
  abstract revokeAccessLease(id: string, request: AccessLeaseRevokeRequest): Promise<void>;

  abstract listInboxRequests(): Promise<AccessRequestDetailsResponse[]>;
  abstract listInboxHistory(): Promise<AccessRequestDetailsResponse[]>;
  abstract listMyAccessRequests(): Promise<AccessRequestDetailsResponse[]>;
  abstract listActiveLeases(): Promise<AccessLeaseResponse[]>;

  abstract getGovernanceSummary(
    organizationId: string,
  ): Promise<OrganizationGovernanceSummaryResponse>;
  /**
   * Org-wide kill switch: revokes all active leases in the organization. When
   * `blockNewLeases` is true,    * activated until {@link unblockNewLeases} lifts it.
   */
  abstract bulkRevokeLeases(
    organizationId: string,
    blockNewLeases: boolean,
  ): Promise<BulkRevokeResult>;
  /** Lifts an org-wide leasing freeze so approved requests can be activated again. */
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
