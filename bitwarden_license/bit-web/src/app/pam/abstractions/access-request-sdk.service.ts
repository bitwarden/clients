import type {
  AccessLeaseView,
  AccessPreCheckView,
  AccessRequestCreateRequest,
  AccessRequestId,
  AccessRequestResultView,
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
 *
 * The three cipher-scoped methods (`getCipherAccessState`, `preCheckAccessRequest`,
 * `createAccessRequest`) back the vault-gating surfaces (cipher-view banner, vault-row
 * badge): reading the caller's current access state for a cipher, resolving the approval
 * workflow before submitting, and opening a new request. `cipherId` is taken as a plain
 * `string` (matching the seam tokens in `libs/vault`/`apps/web`, which never carry the
 * SDK's branded `CipherId`) and converted internally.
 */
export abstract class AccessRequestSdkService {
  abstract listMyAccessRequests(): Promise<AccessRequestView[]>;
  abstract getAccessRequest(id: AccessRequestId): Promise<AccessRequestView>;
  abstract activateAccessRequest(id: AccessRequestId): Promise<AccessLeaseView>;
  abstract cancelAccessRequest(id: AccessRequestId): Promise<void>;
  abstract getCipherAccessState(cipherId: string): Promise<CipherAccessStateView>;
  abstract preCheckAccessRequest(cipherId: string): Promise<AccessPreCheckView>;
  abstract createAccessRequest(
    cipherId: string,
    request: AccessRequestCreateRequest,
  ): Promise<AccessRequestResultView>;
}
