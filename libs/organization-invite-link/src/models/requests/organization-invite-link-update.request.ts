export class OrganizationInviteLinkUpdateRequest {
  allowedDomains: string[];

  constructor(allowedDomains: string[]) {
    if (!allowedDomains || allowedDomains.length === 0) {
      throw new Error("At least one allowed domain is required.");
    }

    this.allowedDomains = allowedDomains;
  }
}
