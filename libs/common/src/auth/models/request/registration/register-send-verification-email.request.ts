import { RegisterStartOpenOrgInviteRequest } from "./register-start-open-org-invite.request";

export class RegisterSendVerificationEmailRequest {
  constructor(
    public email: string,
    public name: string,
    public receiveMarketingEmails: boolean,
    /**
     * Present when the registrant reached this flow from an open-org-invite link. Carries
     * data required to identify the invite on the server plus the sealed data blob echoed
     * to the verification-email URL so the invite can be reconstituted after crossing the
     * tab-boundary.
     */
    public openOrgInvite?: RegisterStartOpenOrgInviteRequest,
  ) {}
}
