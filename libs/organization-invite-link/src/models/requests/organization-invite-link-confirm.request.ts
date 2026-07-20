export class OrganizationInviteLinkConfirmRequest {
  code: string;
  orgUserKey: string;
  resetPasswordKey?: string;
  defaultUserCollectionName: string;

  constructor(c: {
    code: string;
    orgUserKey: string;
    resetPasswordKey?: string;
    defaultUserCollectionName: string;
  }) {
    this.code = c.code;
    this.orgUserKey = c.orgUserKey;
    this.resetPasswordKey = c.resetPasswordKey;
    this.defaultUserCollectionName = c.defaultUserCollectionName;
  }
}
