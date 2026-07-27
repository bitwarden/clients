export class OrganizationInviteLinkValidateEmailDomainRequest {
  organizationId: string;
  code: string;
  email: string;

  constructor(c: { organizationId: string; code: string; email: string }) {
    this.organizationId = c.organizationId;
    this.code = c.code;
    this.email = c.email;
  }
}
