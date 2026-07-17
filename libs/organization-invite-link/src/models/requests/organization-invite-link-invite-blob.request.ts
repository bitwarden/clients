export class OrganizationInviteLinkInviteBlobRequest {
  organizationId: string;
  code: string;

  constructor(c: { organizationId: string; code: string }) {
    this.organizationId = c.organizationId;
    this.code = c.code;
  }
}
