export class DeleteTwoFactorAuthenticatorRequest {
  constructor(
    public key: string,
    public userVerificationToken: string,
  ) {}
}
