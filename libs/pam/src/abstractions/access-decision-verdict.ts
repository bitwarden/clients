/**
 * The verdict an approver reaches on an access request. Shared by the decision *request*
 * (the input to `POST /access-requests/{id}/decision`) and the approver objects on the
 * access-request details *response*, so it lives in `abstractions` rather than alongside
 * either one.
 */
export const AccessDecisionVerdict = Object.freeze({
  Approve: 0,
  Deny: 1,
} as const);
export type AccessDecisionVerdict =
  (typeof AccessDecisionVerdict)[keyof typeof AccessDecisionVerdict];
