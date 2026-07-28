export class OrganizationInviteLinkAcceptRequest {
  organizationId: string;
  code: string;
  resetPasswordKey?: string;

  constructor(c: { organizationId: string; code: string; resetPasswordKey?: string }) {
    this.organizationId = c.organizationId;
    this.code = c.code;
    this.resetPasswordKey = c.resetPasswordKey;
  }
}
