export type AccessRequestForApproval = { requesterId: string };
export type UserForApproval = { id: string };

export function canApprove(
  request: AccessRequestForApproval,
  currentUser: UserForApproval,
): boolean {
  return request.requesterId !== currentUser.id;
}
