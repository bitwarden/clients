export type LeaseRequestForApproval = { requesterUserId: string };
export type UserForApproval = { id: string };

export function canApprove(
  request: LeaseRequestForApproval,
  currentUser: UserForApproval,
): boolean {
  return request.requesterUserId !== currentUser.id;
}
