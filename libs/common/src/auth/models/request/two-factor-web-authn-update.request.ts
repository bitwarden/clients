export class TwoFactorWebAuthnUpdateRequest {
  deviceResponse!: PublicKeyCredential;
  name!: string;
  id!: number;
  userVerificationToken!: string;
}
