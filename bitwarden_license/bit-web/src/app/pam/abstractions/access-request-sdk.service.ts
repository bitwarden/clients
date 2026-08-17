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
 * SDK (`client.commercial().pam().access_requests()`). These calls are
 * user-scoped — they operate on the current user's own requests, so no
 * `organizationId` is threaded through. Errors surface as the SDK's flat
 * `LeasingError` shape (see `./access-lease`) rather than `ErrorResponse`.
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

  /**
   * Resolve which approval path a request for this cipher would take, without committing to one.
   * The cipher-view banner runs this before showing its form so the requester sees the right
   * shape: the `automatic` path collects only a duration, the `human` path collects a window
   * plus a justification. `hasActiveLease` short-circuits both — reveal the credential instead.
   */
  abstract preCheck(cipherId: string): Promise<AccessPreCheckView>;

  /**
   * Open an access request for a gated cipher. Which fields `request` must carry depends on the
   * approval mode {@link preCheck} reported: `durationSeconds` on the automatic path,
   * `start`/`end`/`reason` on the human path. No lease is minted here on either path — the
   * requester activates the resulting request (see {@link activateAccessRequest}).
   */
  abstract submitAccessRequest(
    cipherId: string,
    request: AccessRequestCreateRequest,
  ): Promise<AccessRequestResultView>;
}
