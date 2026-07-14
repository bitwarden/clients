import { Invite } from "@bitwarden/sdk-internal";

export class OrganizationInviteLinkCreateRequest {
  allowedDomains: string[];
  invite: Invite;
  supportsConfirmation: boolean;

  constructor(c: { allowedDomains: string[]; invite: Invite; supportsConfirmation: boolean }) {
    if (!c.allowedDomains || c.allowedDomains.length === 0) {
      throw new Error("At least one allowed domain is required.");
    }
    if (!c.invite) {
      throw new Error("Invite is required.");
    }

    this.allowedDomains = c.allowedDomains;
    this.invite = c.invite;
    this.supportsConfirmation = c.supportsConfirmation;
  }
}
