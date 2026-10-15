export type {
  AccessCondition,
  AccessRuleAddEditRequest,
  AccessRuleErrorVariant,
  AccessRuleId,
  AccessRuleView,
  KnownAccessCondition,
} from "./abstractions/access-rule";
export {
  accessRuleErrorMessage,
  isAccessRuleNotFound,
  isHumanApproval,
  isIpAllowlist,
  isKnownAccessCondition,
} from "./abstractions/access-rule";
export { AccessRuleSdkService } from "./abstractions/access-rule-sdk.service";
export { apiErrorBodyMessage } from "./abstractions/api-error";

export type {
  AccessApprovalMode,
  AccessApprover,
  AccessDecider,
  AccessDecisionVerdict,
  AccessLeaseExtensionRequest,
  AccessLeaseId,
  AccessLeaseRevokeRequest,
  AccessLeaseStatus,
  AccessLeaseView,
  AccessPreCheckView,
  AccessRequestCreateRequest,
  AccessRequestDecisionView,
  AccessRequestId,
  AccessRequestResultView,
  AccessRequestStatus,
  AccessRequestSummaryView,
  AccessRequestView,
  CipherAccessStateView,
  LeasingError,
} from "./abstractions/access-lease";
export { AccessRequestSdkService } from "./abstractions/access-request-sdk.service";
export { AccessLeaseSdkService } from "./abstractions/access-lease-sdk.service";
export { AccessRefreshService } from "./abstractions/access-refresh.service";
export { AccessEventService } from "./abstractions/access-event.service";
export { LeasingErrorService } from "./abstractions/leasing-error.service";

export {
  ACCESS_RULE_DESCRIPTION_MAX_LENGTH,
  ACCESS_RULE_NAME_MAX_LENGTH,
  accessRuleToFormValue,
  accessRuleToRequest,
  formValueToRequest,
  NO_DURATION_CAP,
} from "./helpers/access-rule-request";
export type { AccessRuleFormPatch, AccessRuleFormValue } from "./helpers/access-rule-request";
export { accessRuleToCopyRequest, copyRuleName } from "./helpers/access-rule-copy";
export { resolveCollectionNames } from "./helpers/collection-names";
export { conflictingCollectionIds } from "./helpers/collection-conflicts";
export { accessRuleDeleteConfirmOptions } from "./helpers/access-rule-delete-confirm";
export { accessRuleDeactivateConfirmOptions } from "./helpers/access-rule-deactivate-confirm";
export { filterRulesToToggle } from "./helpers/filter-rules-to-toggle";
export { approvalMethodLabelKeys } from "./helpers/approval-method";
export {
  AccessRuleStatusFilter,
  AccessRuleFilter,
  accessRuleMatchesFilter,
} from "./helpers/access-rule-table";
export { formatRelativeTime } from "./date/relative-time";
export { formatRemaining } from "./date/format-remaining";
export { liveActiveLease, rereadOnLapse } from "./helpers/lease-liveness";
export { findHumanDecision, humanApprover } from "./helpers/find-human-decision";
export { requestedWindowSeconds } from "./helpers/requested-window";
export { isActionableRequest } from "./helpers/actionable-requests";
export { canApprove } from "./helpers/can-approve";
export type { AccessRequestForApproval, UserForApproval } from "./helpers/can-approve";
export { elapsedLabel } from "./date/elapsed";
export type { ElapsedLabel } from "./date/elapsed";
export { ApprovalSdkService } from "./abstractions/approval-sdk.service";
export { durationLabel, exactWindow, reasonText, relativeStart } from "./helpers/approval-window";
export type { LabelValue } from "./helpers/approval-window";
export {
  ACCESS_RULE_DURATION_PRESETS,
  DEFAULT_ACCESS_RULE_DURATION_SECONDS,
  DEFAULT_MAX_EXTENSION_DURATION_SECONDS,
  DEFAULT_REQUEST_ACCESS_DURATION_SECONDS,
  DurationUnit,
  EXTENSION_DURATION_OPTIONS,
  REQUEST_ACCESS_DURATION_PRESETS,
  snapToNearestDuration,
  snapToNearestAccessRuleDuration,
  pickDurationUnit,
  requestDurationOptions,
} from "./helpers/lease-window.utils";
export type { RequestDurationOption } from "./helpers/lease-window.utils";
export {
  composeRequestWindow,
  defaultRequestWindow,
  requestWindowProblem,
  startTimeSlots,
  toDateInputValue,
  toTimeInputValue,
  windowEndAt,
} from "./helpers/request-access-window";
export type { RequestWindowFormValue, RequestWindowProblem } from "./helpers/request-access-window";
export {
  REQUEST_ACCESS_SDK_ERRORS,
  REQUEST_ACCESS_SERVER_ERRORS,
  classifyRequestAccessError,
} from "./helpers/request-access-error";
export type { RequestAccessErrorOutcome } from "./helpers/request-access-error";
export { accessRuleErrorMessageKey, classifyAccessRuleError } from "./helpers/access-rule-error";
export type { AccessRuleErrorField, AccessRuleErrorOutcome } from "./helpers/access-rule-error";
export { activateAccessErrorMessageKey } from "./helpers/activate-access-error";
export {
  DECIDE_ACCESS_SERVER_ERRORS,
  decideAccessErrorMessageKey,
  isRequestNoLongerPendingError,
} from "./helpers/decide-access-error";
export { selectedFilterStrings } from "./helpers/selected-filter-strings";
export {
  accessConnectorDeactivateConfirmOptions,
  accessConnectorDeleteConfirmOptions,
} from "./helpers/access-connector-confirm";
export { isGovernedCipher } from "./helpers/governed-cipher";

export { AccessLeasesSdkService } from "./services/access-leases-sdk.service";
export { AccessRequestCancelService } from "./services/access-request-cancel.service";
export { AccessRequestsSdkService } from "./services/access-requests-sdk.service";
export { AccessRulesSdkService } from "./services/access-rules-sdk.service";
export { ApprovalsSdkService } from "./services/approvals-sdk.service";
export { DefaultAccessEventService } from "./services/default-access-event.service";
export { DefaultAccessRefreshService } from "./services/default-access-refresh.service";
export { DefaultLeasingErrorService } from "./services/default-leasing-error.service";
export { MyLeasesService } from "./services/my-leases.service";
export { PamGatedCipherReloader } from "./services/pam-gated-cipher-reloader.service";
export { callerOrganizations$, unlicensedForPam } from "./services/pam-membership";

export { DurationLongPipe } from "./date/duration-long.pipe";
export { DurationShortPipe } from "./date/duration-short.pipe";
export { RelativeTimePipe } from "./date/relative-time.pipe";
export { RemainingTimePipe } from "./date/remaining-time.pipe";

export type { AccessBadgeState } from "./access-state-badge/access-badge-state";
export {
  ENDING_SOON_THRESHOLD_MS,
  cipherAccessBadgeState,
} from "./access-state-badge/access-badge-state";
export { AccessBadgeTickerService } from "./access-state-badge/access-badge-ticker.service";
export { AccessStateBadgeComponent } from "./access-state-badge/access-state-badge.component";
export { ItemDetailsStateBadgeComponent } from "./item-details-state-badge/item-details-state-badge.component";
export { CipherViewBannerComponent } from "./cipher-view-banner/cipher-view-banner.component";
export { ExtendLeaseDialogComponent } from "./access-requests/extend-lease-dialog/extend-lease-dialog.component";
