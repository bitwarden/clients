export class TwoFactorWebAuthnUpdateRequest {
  constructor(
    public deviceResponse: PublicKeyCredential,
    public name: string,
    public id: number,
    public userVerificationToken: string,
  ) {}
}
