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
 * Any error the PAM leasing surface can throw.
 *
 * The SDK splits its failures per client — `AccessRequestError`, `ApprovalError`,
 * `AccessLeaseError` — so each caller only sees the variants its own call can produce. The UI
 * treats all three alike, reading `variant` (`"Api"` carries the server's message) through
 * `LeasingErrorService`.
 */
export type LeasingError = AccessRequestError | ApprovalError | AccessLeaseError;
