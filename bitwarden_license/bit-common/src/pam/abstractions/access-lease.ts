import type { AccessLeaseError, AccessRequestError, ApprovalError } from "@bitwarden/sdk-internal";

export type {
  AccessApprovalMode,
  AccessApprover,
  AccessDecider,
  AccessDecisionVerdict,
  AccessLeaseError,
  AccessLeaseExtensionRequest,
  AccessLeaseId,
  AccessLeaseRevokeRequest,
  AccessLeaseStatus,
  AccessLeaseTermination,
  AccessLeaseView,
  AccessPreCheckView,
  AccessRequestCreateRequest,
  AccessRequestDecisionView,
  AccessRequestError,
  AccessRequestId,
  AccessRequestResultView,
  AccessRequestStatus,
  AccessRequestSummaryView,
  AccessRequestView,
  ApprovalError,
  CipherAccessStateView,
} from "@bitwarden/sdk-internal";

/**
 * Any error the PAM leasing clients throw. The UI reads all three alike through
 * `LeasingErrorService`, where an `"Api"` variant carries the server's message.
 */
export type LeasingError = AccessRequestError | ApprovalError | AccessLeaseError;
