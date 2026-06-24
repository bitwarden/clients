export class OrganizationInviteLinkAcceptRequest {
  code: string;
  resetPasswordKey?: string;

  constructor(c: { code: string; resetPasswordKey?: string }) {
    this.code = c.code;
    this.resetPasswordKey = c.resetPasswordKey;
  }
}
