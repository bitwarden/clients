export class OrganizationInviteLinkValidateEmailDomainRequest {
  code: string;
  email: string;

  constructor(c: { code: string; email: string }) {
    this.code = c.code;
    this.email = c.email;
  }
}
