/** Just the requester identity a self-approval check needs. */
export type AccessRequestForApproval = { requesterId: string };

/** Just the identity of the viewer a self-approval check needs. */
export type UserForApproval = { id: string };

/**
 * Whether `currentUser` may decide `request` — that is, whether it is somebody else's.
 *
 * This is ONLY the self-approval rule. Whether the viewer has approval privileges at all is a
 * separate question answered by `ApprovalPrivilegeService`, and the server enforces both regardless.
 * The parameter types are structural on purpose: this stays free of any dependency on the request or
 * account models so it can be unit-tested with two object literals.
 */
export function canApprove(
  request: AccessRequestForApproval,
  currentUser: UserForApproval,
): boolean {
  return request.requesterId !== currentUser.id;
}
