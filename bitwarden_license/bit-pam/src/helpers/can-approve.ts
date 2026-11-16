export type AccessRequestForApproval = { requesterId: string };

export type UserForApproval = { id: string };

/**
 * The self-approval rule only; approval privileges come from `ApprovalPrivilegeService`, and the
 * server enforces both.
 */
export function canApprove(
  request: AccessRequestForApproval,
  currentUser: UserForApproval,
): boolean {
  return request.requesterId !== currentUser.id;
}
