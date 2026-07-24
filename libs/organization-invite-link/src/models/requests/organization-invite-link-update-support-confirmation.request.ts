import { Invite } from "@bitwarden/sdk-internal";

export class OrganizationInviteLinkUpdateSupportConfirmationRequest {
  /** The invite cryptographic material for the invite link. */
  invite: Invite;

  /** Whether this invite link can be used to confirm a user. */
  supportsConfirmation: boolean;

  constructor(c: { invite: Invite; supportsConfirmation: boolean }) {
    if (!c.invite) {
      throw new Error("Invite is required.");
    }
    this.invite = c.invite;
    this.supportsConfirmation = c.supportsConfirmation;
  }
}
