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
 * The SDK splits its failures per client — `AccessRequestError` (request/activate/cancel),
 * `ApprovalError` (decide), and `AccessLeaseError` (read/extend/end) — so each caller only sees
 * the variants its own call can produce. The UI treats all three alike: it reads `variant`, where
 * `"Api"` carries the server's message, and never inspects the rest. This union is therefore the
 * single shape consumers detect through `LeasingErrorService`.
 */
export type LeasingError = AccessRequestError | ApprovalError | AccessLeaseError;
