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
 * The caller's own access requests. Errors surface as the SDK's flat `LeasingError`, not
 * `ErrorResponse`.
 */
export abstract class AccessRequestSdkService {
  abstract listMyAccessRequests(): Promise<AccessRequestView[]>;
  abstract getAccessRequest(id: AccessRequestId): Promise<AccessRequestView>;
  abstract activateAccessRequest(id: AccessRequestId): Promise<AccessLeaseView>;
  abstract cancelAccessRequest(id: AccessRequestId): Promise<void>;

  /** Takes a plain `string`, since the OSS seam tokens never carry the SDK's branded `CipherId`. */
  abstract getCipherAccessState(cipherId: string): Promise<CipherAccessStateView>;

  /**
   * Which approval path a request for this cipher would take, without submitting one: `automatic`
   * collects a duration, `human` a window and reason.
   */
  abstract preCheck(cipherId: string): Promise<AccessPreCheckView>;

  /**
   * `request` carries `durationSeconds` on the automatic path and `start`/`end`/`reason` on the
   * human path. Neither path mints a lease; the requester activates the resulting request.
   */
  abstract submitAccessRequest(
    cipherId: string,
    request: AccessRequestCreateRequest,
  ): Promise<AccessRequestResultView>;
}
