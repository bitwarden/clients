export class UpdateTwoFactorWebAuthnRequest {
  deviceResponse!: PublicKeyCredential;
  name!: string;
  id!: number;
  userVerificationToken!: string;
}
