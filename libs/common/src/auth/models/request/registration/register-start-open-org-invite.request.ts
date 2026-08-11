import { OpenOrgInviteRequest } from "./open-org-invite.request";

/**
 * Register-start payload for an open organization invite link: the invite's identifying data
 * plus the opaque SDK-produced sealed blob that is echoed to the verification-email URL so
 * the invite data can be reconstituted after crossing the tab-boundary.
 */
export class RegisterStartOpenOrgInviteRequest extends OpenOrgInviteRequest {
  constructor(
    organizationId: string,
    code: string,
    public sealedOpenOrgInviteData: string,
  ) {
    super(organizationId, code);
  }
}
