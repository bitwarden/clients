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
