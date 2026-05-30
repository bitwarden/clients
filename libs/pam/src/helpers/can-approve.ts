export type AccessRequestForApproval = { requesterUserId: string };
export type UserForApproval = { id: string };

export function canApprove(
  request: AccessRequestForApproval,
  currentUser: UserForApproval,
): boolean {
  return request.requesterUserId !== currentUser.id;
}
