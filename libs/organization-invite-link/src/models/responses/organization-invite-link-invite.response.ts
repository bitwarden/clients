import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Invite } from "@bitwarden/sdk-internal";

/**
 * The invite for an organization's invite link. The invite is an opaque cryptographic value that
 * the server stores and transports but never inspects; it is decrypted client-side to reconstruct
 * and confirm the invite link.
 */
export class OrganizationInviteLinkInviteResponse extends BaseResponse {
  /** The opaque, encrypted invite. */
  invite: Invite;

  constructor(response: any) {
    super(response);
    this.invite = this.getResponseProperty("Invite") as Invite;
  }
}
