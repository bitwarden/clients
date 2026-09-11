/** Just the requester identity a self-approval check needs. */
export type AccessRequestForApproval = { requesterId: string };

/** Just the identity of the viewer a self-approval check needs. */
export type UserForApproval = { id: string };

/**
 * Whether `currentUser` may decide `request` — whether it's somebody else's.
 *
 * Only the self-approval rule; whether the viewer has approval privileges at all is answered by
 * `ApprovalPrivilegeService`, and the server enforces both regardless. Structural parameter
 * types keep this free of the request/account models, testable with two object literals.
 */
export function canApprove(
  request: AccessRequestForApproval,
  currentUser: UserForApproval,
): boolean {
  return request.requesterId !== currentUser.id;
}
