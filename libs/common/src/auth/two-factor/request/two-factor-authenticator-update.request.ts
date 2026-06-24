export class TwoFactorAuthenticatorUpdateRequest {
  constructor(
    public token: string,
    public key: string,
    public userVerificationToken: string,
  ) {}
}
