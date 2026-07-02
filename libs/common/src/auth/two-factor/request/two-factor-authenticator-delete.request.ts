export class TwoFactorAuthenticatorDeleteRequest {
  constructor(
    public key: string,
    public userVerificationToken: string,
  ) {}
}
