export class RegisterSendVerificationEmailRequest {
  constructor(
    public email: string,
    public name: string,
    public receiveMarketingEmails: boolean,
  ) {}
}
