import { Invite } from "@bitwarden/sdk-internal";

export class OrganizationInviteLinkRefreshRequest {
  invite: Invite;
  supportsConfirmation: boolean;

  constructor(c: { invite: Invite; supportsConfirmation: boolean }) {
    if (!c.invite) {
      throw new Error("Invite is required.");
    }
    this.invite = c.invite;
    this.supportsConfirmation = c.supportsConfirmation;
  }
}
