/**
 * The data required to retrieve the invite for an organization's invite link. The server uses
 * these to locate the link and validate that the requesting user is allowed to retrieve its invite.
 */
export class OrganizationInviteLinkInviteRequest {
  /** The ID of the organization whose invite link the invite is being retrieved for. */
  organizationId: string;

  /** The secret code embedded in the invite link. */
  code: string;

  constructor(c: { organizationId: string; code: string }) {
    this.organizationId = c.organizationId;
    this.code = c.code;
  }
}
