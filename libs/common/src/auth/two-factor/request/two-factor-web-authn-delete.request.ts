export class TwoFactorWebAuthnDeleteRequest {
  constructor(
    public id: number,
    public userVerificationToken: string,
  ) {}
}
