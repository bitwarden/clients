// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export class MenuUpdateRequest {
  activeUserId: string;
  accounts: { [userId: string]: MenuAccount };
}

export class MenuAccount {
  isAuthenticated: boolean;
  isLocked: boolean;
  isLockable: boolean;
  userId: string;
  email: string;
  hasMasterPassword: boolean;
}
