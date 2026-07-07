export class OrganizationInviteLinkUpdateRequest {
  allowedDomains: string[];
  supportsConfirmation: boolean;

  constructor(c: { allowedDomains: string[]; supportsConfirmation: boolean }) {
    if (!c.allowedDomains || c.allowedDomains.length === 0) {
      throw new Error("At least one allowed domain is required.");
    }

    this.allowedDomains = c.allowedDomains;
    this.supportsConfirmation = c.supportsConfirmation;
  }
}
