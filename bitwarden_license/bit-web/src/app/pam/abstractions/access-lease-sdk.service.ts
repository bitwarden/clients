import type {
  AccessLeaseExtensionRequest,
  AccessLeaseId,
  AccessLeaseRevokeRequest,
  AccessLeaseView,
  AccessRequestView,
} from "./access-lease";

/**
 * Lease lifecycle (list mine/extend/end) is served by the Rust SDK
 * (`client.commercial().pam().leases()`). Like {@link AccessRequestSdkService}
 * these calls are user-scoped, not org-scoped — no `organizationId` is
 * threaded through. Errors surface as the SDK's flat `LeasingError` shape
 * (see `./access-lease`) rather than `ErrorResponse`.
 *
 * Deliberately omits `list_active` — that governance-facing read (all active
 * leases across an org) is out of scope for the "My access" surface this
 * service backs.
 */
export abstract class AccessLeaseSdkService {
  abstract listMyLeases(): Promise<AccessLeaseView[]>;
  abstract extendLease(
    id: AccessLeaseId,
    request: AccessLeaseExtensionRequest,
  ): Promise<AccessRequestView>;
  abstract endLease(id: AccessLeaseId, request: AccessLeaseRevokeRequest): Promise<void>;
}
