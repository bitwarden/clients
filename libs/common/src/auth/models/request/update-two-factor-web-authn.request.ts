// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecretVerificationRequest } from "./secret-verification.request";

export class UpdateTwoFactorWebAuthnRequest extends SecretVerificationRequest {
  deviceResponse: PublicKeyCredential;
  name: string;
  id: number;
}
