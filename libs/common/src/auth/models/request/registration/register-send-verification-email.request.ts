export class RegisterSendVerificationEmailRequest {
  constructor(
    public email: string,
    public name: string,
    public receiveMarketingEmails: boolean,
    /**
     * Optional sealed open-organization-invite blob to embed in the verification-email URL
     * fragment when the registrant reached this flow from an open-org-invite link.
     */
    public sealedOpenOrgInviteData?: string,
  ) {}
}
