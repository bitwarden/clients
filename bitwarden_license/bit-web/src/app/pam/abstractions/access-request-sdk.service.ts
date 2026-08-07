import type {
  AccessLeaseView,
  AccessRequestId,
  AccessRequestView,
  CipherAccessStateView,
} from "./access-lease";

/**
 * Access-request lifecycle (list/get/activate/cancel) is served by the Rust
 * SDK (`client.commercial().pam().access_requests()`). Unlike
 * {@link AccessRuleSdkService} these calls are user-scoped, not org-scoped —
 * they operate on the current user's own requests, so no `organizationId` is
 * threaded through. Errors surface as the SDK's flat `LeasingError` shape
 * (see `./access-lease`) rather than `ErrorResponse`.
 */
export abstract class AccessRequestSdkService {
  abstract listMyAccessRequests(): Promise<AccessRequestView[]>;
  abstract getAccessRequest(id: AccessRequestId): Promise<AccessRequestView>;
  abstract activateAccessRequest(id: AccessRequestId): Promise<AccessLeaseView>;
  abstract cancelAccessRequest(id: AccessRequestId): Promise<void>;

  /**
   * Read the caller's current access state for a gated cipher — the active lease, pending
   * request, or approved-but-not-activated request that drives the vault-row access-state
   * badge. `cipherId` is a plain `string` (matching the seam tokens in `libs/vault`/`apps/web`,
   * which never carry the SDK's branded `CipherId`) and converted internally.
   */
  abstract getCipherAccessState(cipherId: string): Promise<CipherAccessStateView>;
}
