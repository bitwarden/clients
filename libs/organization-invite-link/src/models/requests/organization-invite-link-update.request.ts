export class OrganizationInviteLinkUpdateRequest {
  allowedDomains: string[];

  constructor(c: { allowedDomains: string[] }) {
    if (!c.allowedDomains || c.allowedDomains.length === 0) {
      throw new Error("At least one allowed domain is required.");
    }
    this.allowedDomains = c.allowedDomains;
  }
}
